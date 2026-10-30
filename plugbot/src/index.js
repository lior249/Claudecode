// Point d'entrée de PlugBot.

import { dirname, join } from 'node:path';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { createBoards } from './boards.js';
import { findPermissionProblems } from './checks.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createHandlers } from './handlers.js';
import { createJobs } from './jobs.js';
import { acquireLock } from './lock.js';
import { createInteractionHandler } from './events/interactions.js';
import { createEventService } from './events/service.js';
import { createEventStore } from './events/store.js';
import { createJourneyInteractions } from './journey/interactions.js';
import { createJourney } from './journey/service.js';
import { createJourneyStore } from './journey/store.js';
import { createPrison } from './prison.js';
import { createQueue } from './queue.js';
import { startup } from './sync.js';
import { createTracker } from './tracker.js';

const TICK_MS = 60 * 1000;

const config = loadConfig();

const otherPid = acquireLock(join(dirname(config.databasePath), 'plugbot.pid'));
if (otherPid) {
  console.error(
    `[PlugBot] Un autre PlugBot tourne déjà (processus ${otherPid}) : celui-ci s'arrête pour ne pas tout publier deux fois.\n` +
      '[PlugBot] Tape « pm2 list » pour voir les PlugBot lancés, et « pm2 delete <numéro> » pour supprimer le doublon.',
  );
  process.exit(1);
}

const db = openDatabase(config.databasePath);
const events = createEventStore(db.connection);
const journeyStore = createJourneyStore(db.connection);
const tracker = createTracker({ config, db, journey: config.journeyCategoryId ? journeyStore : null });
const enqueue = createQueue();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  // Nécessaire pour recevoir les réactions et suppressions sur des messages anciens.
  partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
});

let handlers = null;
let eventService = null;
let journey = null;
let onInteraction = null;
let onJourneyInteraction = null;

// Salons sans lesquels PlugBot ne peut pas tourner. Les autres (top all-time, planification) sont
// facultatifs : s'ils sont introuvables, seule leur fonction est désactivée.
const REQUIRED_CHANNELS = new Set(['results', 'showup', 'week', 'month', 'prison']);

async function fetchChannels(guild) {
  const channels = {};
  for (const [name, id] of Object.entries(config.channels)) {
    if (!id) continue;
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (channel?.isTextBased()) {
      channels[name] = channel;
      continue;
    }
    const problem = `Salon introuvable ou sans messages : ${name} (${id})`;
    if (REQUIRED_CHANNELS.has(name)) throw new Error(problem);
    console.error(`[PlugBot] ${problem}. Cette fonction est désactivée.`);
  }
  return channels;
}

client.once(Events.ClientReady, (readyClient) =>
  enqueue(async () => {
    const guild = await readyClient.guilds.fetch(config.guildId);
    await guild.members.fetch();
    const ctx = { config, db, tracker, events, guild, channels: await fetchChannels(guild) };
    ctx.prison = createPrison(ctx);

    if (!ctx.channels.allTime) console.warn('[PlugBot] ALLTIME_CHANNEL_ID absent du .env : le top all-time ne sera pas publié.');
    const problems = findPermissionProblems(ctx);
    if (problems.length > 0) {
      console.error(`[PlugBot] Permissions à corriger sur Discord :\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    } else {
      console.log('[PlugBot] Permissions OK.');
    }

    // La planification des événements ne doit jamais empêcher le reste de PlugBot de démarrer :
    // si le panneau ne peut pas être publié, PlugBot le signale et réessaie chaque minute.
    if (ctx.channels.planning && ctx.channels.announceFree && ctx.channels.announcePlug) {
      ctx.eventService = createEventService(ctx);
      await ctx.eventService.ensurePanel();
      onInteraction = createInteractionHandler(ctx, ctx.eventService);
    } else {
      console.warn('[PlugBot] Planification des événements désactivée : PLANNING_CHANNEL_ID, ANNOUNCE_FREE_CHANNEL_ID ou ANNOUNCE_PLUG_CHANNEL_ID manque dans .env (ou le salon est introuvable).');
    }

    // Le parcours de l'accompagnement : comme les événements, il ne doit jamais empêcher PlugBot de démarrer.
    if (config.journeyCategoryId) {
      ctx.journey = createJourney(ctx, journeyStore);
      await ctx.journey.start(Date.now());
      onJourneyInteraction = createJourneyInteractions(ctx, ctx.journey);
    }

    const ready = createHandlers(ctx);
    const jobs = createJobs(ctx, ready);
    try {
      await startup(ctx, ready, jobs);
    } catch (error) {
      console.error('[PlugBot] Rattrapage incomplet au démarrage :', error);
    }
    // Créés après le rattrapage : les classements en direct sont mis à jour une fois, au premier tick,
    // et non à chaque résultat rattrapé.
    ctx.boards = createBoards(ctx);
    handlers = ready;
    eventService = ctx.eventService ?? null;
    journey = ctx.journey ?? null;

    await jobs.tick();
    setInterval(() => enqueue(jobs.tick), TICK_MS);
    console.log(`[PlugBot] Connecté en tant que ${readyClient.user.tag}.`);
  }),
);

client.on(Events.MessageCreate, (message) =>
  enqueue(async () => {
    await handlers?.onNewMessage(message);
    await eventService?.onTicketMessage(message);
    await journey?.onMessage(message, Date.now());
  }),
);
client.on(Events.MessageReactionAdd, (reaction, user) =>
  enqueue(async () => {
    await handlers?.onReactionAdd(reaction, user);
    await eventService?.onReaction(reaction, user, Date.now());
  }),
);
// Les clics doivent recevoir une réponse en moins de 3 secondes : ils ne passent pas par la file d'attente.
client.on(Events.InteractionCreate, (interaction) => {
  onInteraction?.(interaction);
  onJourneyInteraction?.(interaction);
});
client.on(Events.MessageReactionRemove, (reaction, user) => enqueue(() => handlers?.onReactionRemove(reaction, user)));
client.on(Events.MessageDelete, (message) => enqueue(() => handlers?.onMessageDelete(message)));
client.on(Events.GuildMemberUpdate, (_oldMember, member) => enqueue(() => handlers?.onMemberUpdate(member)));
client.on(Events.MessageBulkDelete, (messages) =>
  enqueue(async () => {
    for (const message of messages.values()) await handlers?.onMessageDelete(message);
  }),
);

process.on('unhandledRejection', (error) => console.error('[PlugBot] Erreur non gérée :', error));

function shutdown() {
  client.destroy().finally(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(config.token);

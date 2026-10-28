// Point d'entrée de PlugBot.

import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createHandlers } from './handlers.js';
import { createJobs } from './jobs.js';
import { createQueue } from './queue.js';
import { startup } from './sync.js';
import { createTracker } from './tracker.js';

const TICK_MS = 60 * 1000;

const config = loadConfig();
const db = openDatabase(config.databasePath);
const tracker = createTracker({ config, db });
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

async function fetchChannels(guild) {
  const channels = {};
  for (const [name, id] of Object.entries(config.channels)) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel?.isTextBased()) throw new Error(`Salon introuvable ou sans messages : ${name} (${id})`);
    channels[name] = channel;
  }
  return channels;
}

client.once(Events.ClientReady, (readyClient) =>
  enqueue(async () => {
    const guild = await readyClient.guilds.fetch(config.guildId);
    await guild.members.fetch();
    const ctx = { config, db, tracker, guild, channels: await fetchChannels(guild) };

    const ready = createHandlers(ctx);
    const jobs = createJobs(ctx, ready);
    try {
      await startup(ctx, ready);
    } catch (error) {
      console.error('[PlugBot] Rattrapage incomplet au démarrage :', error);
    }
    handlers = ready;

    await jobs.tick();
    setInterval(() => enqueue(jobs.tick), TICK_MS);
    console.log(`[PlugBot] Connecté en tant que ${readyClient.user.tag}.`);
  }),
);

client.on(Events.MessageCreate, (message) => enqueue(() => handlers?.onNewMessage(message)));
client.on(Events.MessageReactionAdd, (reaction, user) => enqueue(() => handlers?.onReactionAdd(reaction, user)));
client.on(Events.MessageReactionRemove, (reaction, user) => enqueue(() => handlers?.onReactionRemove(reaction, user)));
client.on(Events.MessageDelete, (message) => enqueue(() => handlers?.onMessageDelete(message)));
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

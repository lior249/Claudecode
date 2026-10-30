// Vérifie au démarrage que PlugBot a les permissions dont il a besoin, et explique ce qui manque.

const PERMISSION_LABELS = {
  ViewChannel: 'Voir le salon',
  SendMessages: 'Envoyer des messages',
  ReadMessageHistory: "Voir les anciens messages",
  EmbedLinks: 'Intégrer des liens',
  AddReactions: 'Ajouter des réactions',
  MentionEveryone: 'Mentionner @everyone, @here et tous les rôles',
  SendPolls: 'Créer des sondages',
  CreatePublicThreads: 'Créer des fils publics',
  SendMessagesInThreads: 'Envoyer des messages dans les fils',
  ManageThreads: 'Gérer les fils',
  ManageChannels: 'Gérer les salons',
  CreatePrivateThreads: 'Créer des fils privés',
  AttachFiles: 'Joindre des fichiers',
};

// Permissions générales dont PlugBot a besoin pour créer et gérer les salons du parcours.
const JOURNEY_NEEDS = ['ManageChannels', 'ManageThreads', 'CreatePrivateThreads', 'SendMessagesInThreads', 'EmbedLinks', 'AttachFiles'];

const CHANNEL_NEEDS = {
  results: ['ViewChannel', 'ReadMessageHistory', 'AddReactions'],
  showup: ['ViewChannel', 'SendMessages', 'MentionEveryone'],
  // Salons top : le classement en direct est un encadré (« Intégrer des liens »), retrouvé après un
  // redémarrage (« Voir les anciens messages »).
  week: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'MentionEveryone'],
  month: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'MentionEveryone'],
  prison: ['ViewChannel', 'SendMessages'],
  allTime: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'MentionEveryone'],
  planning: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'CreatePublicThreads', 'SendMessagesInThreads', 'ManageThreads'],
  planningReminder: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions'],
  announceFree: ['ViewChannel', 'SendMessages', 'MentionEveryone', 'SendPolls'],
  announcePlug: ['ViewChannel', 'SendMessages', 'MentionEveryone', 'SendPolls'],
};

// Rôles que PlugBot donne et retire lui-même.
const MANAGED_ROLES = ['streak', 'weekWinner', 'monthWinner', 'prisoner', 'internalPrisoner'];

// Renvoie la liste des problèmes, en français. Vide si tout va bien.
export function findPermissionProblems({ config, guild, channels }) {
  const me = guild.members.me;
  const problems = [];

  for (const [name, needs] of Object.entries(CHANNEL_NEEDS)) {
    const channel = channels[name];
    if (!channel) continue;
    const missing = channel.permissionsFor(me).missing(needs);
    if (missing.length > 0) {
      problems.push(`#${channel.name} : il manque ${missing.map((perm) => PERMISSION_LABELS[perm] ?? perm).join(', ')}.`);
    }
  }

  if (!me.permissions.has('ManageRoles')) problems.push('Il manque la permission « Gérer les rôles ».');
  if (channels.planning && !me.permissions.has('ManageEvents')) problems.push('Il manque la permission « Gérer les événements ».');
  if (config.journeyCategoryId) {
    const missing = JOURNEY_NEEDS.filter((perm) => !me.permissions.has(perm));
    if (missing.length > 0) {
      problems.push(`Parcours de l'accompagnement : il manque ${missing.map((perm) => `« ${PERMISSION_LABELS[perm]} »`).join(', ')}.`);
    }
    if (!guild.channels.cache.get(config.journeyCategoryId)) problems.push(`Catégorie de l'accompagnement introuvable (${config.journeyCategoryId}).`);
  }

  for (const [key, roleId] of Object.entries(config.roles)) {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      problems.push(`Rôle introuvable : ${key} (${roleId}).`);
    } else if (MANAGED_ROLES.includes(key) && me.roles.highest.comparePositionTo(role) <= 0) {
      problems.push(`Le rôle de PlugBot doit être placé au-dessus du rôle ${role.name}.`);
    }
  }

  return problems;
}

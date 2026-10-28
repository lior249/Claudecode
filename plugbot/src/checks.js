// Vérifie au démarrage que PlugBot a les permissions dont il a besoin, et explique ce qui manque.

const PERMISSION_LABELS = {
  ViewChannel: 'Voir le salon',
  SendMessages: 'Envoyer des messages',
  ReadMessageHistory: "Voir les anciens messages",
  AddReactions: 'Ajouter des réactions',
};

const CHANNEL_NEEDS = {
  results: ['ViewChannel', 'ReadMessageHistory', 'AddReactions'],
  showup: ['ViewChannel', 'SendMessages'],
  week: ['ViewChannel', 'SendMessages'],
  month: ['ViewChannel', 'SendMessages'],
  prison: ['ViewChannel', 'SendMessages'],
  allTime: ['ViewChannel', 'SendMessages'],
};

// Rôles que PlugBot donne et retire lui-même.
const MANAGED_ROLES = ['streak', 'weekWinner', 'monthWinner', 'prisoner'];

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

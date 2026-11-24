'use strict';

const {
  Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const { lienRenouvellement, lienInscription } = require('./liens');
const { JOURS, dateISO, ajouterJours } = require('./coaching');

const JOUR_MS = 24 * 3600 * 1000;
const PALIERS_JOURS = [10, 5, 3, 1]; // 1 = dernières 24 h

function formatPrix(montant, devise) {
  const n = Number(montant);
  const fcfa = ['XOF', 'XAF'].includes(String(devise).toUpperCase());
  return `${n.toLocaleString('fr-FR')} ${fcfa ? 'FCFA' : devise}${fcfa ? ` (≈ ${Math.round(n / 655.957)} €)` : ''}`;
}
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Bob : le bot Discord d'Overmaxx.
// - rappels de renouvellement (10 j, 5 j, 3 j, dernières 24 h) puis retrait du serveur à l'expiration ;
// - Elite : alerte à l'admin 10 jours avant la fin (insatisfait / inconstant) ;
// - coaching : rappel personnalisé, rappel 1 h avant, récap admin 2 h avant la première séance du jour ;
// - commandes admin : /lien-elite, /prolonger, /membre ; candidatures Tally.
function creerBob({ config, db, commandes, coaching, maintenant = () => new Date(), client: clientInjecte, serveur: serveurInjecte } = {}) {
  const actif = config.discordActif || Boolean(clientInjecte);
  const client = clientInjecte || (actif ? new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel],
  }) : null);

  const q = {
    deja: db.prepare('SELECT 1 FROM envois WHERE cle = ?'),
    marquer: db.prepare('INSERT OR IGNORE INTO envois (cle, envoye_le) VALUES (?, ?)'),
    actifsAvecDiscord: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL"),
    expires: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND acces_jusqu_au <= ?"),
    expirer: db.prepare("UPDATE membres SET statut = 'expire', maj_le = ? WHERE id = ? AND statut = 'actif'"),
    autresActifs: db.prepare("SELECT * FROM membres WHERE discord_id = ? AND statut = 'actif' AND id != ?"),
    categoriser: db.prepare('UPDATE membres SET categorie_elite = ?, maj_le = ? WHERE id = ?'),
    membresParDiscord: db.prepare('SELECT * FROM membres WHERE discord_id = ?'),
  };
  const dejaEnvoye = (cle) => Boolean(q.deja.get(cle));
  const marquer = (cle) => q.marquer.run(cle, maintenant().toISOString());

  let serveur = serveurInjecte || null;
  const log = (...a) => console.log('[bob]', ...a);

  // ---------- Envois ----------
  async function messagePrive(discordId, contenu) {
    if (!client || !client.isReady()) return false;
    try {
      const u = await client.users.fetch(discordId);
      await u.send(typeof contenu === 'string' ? { content: contenu } : contenu);
      return true;
    } catch (err) {
      console.warn(`[bob] message privé impossible à ${discordId} : ${err.message}`);
      return false;
    }
  }
  const notifier = {
    admin: (contenu) => (config.discord.adminId ? messagePrive(config.discord.adminId, contenu) : Promise.resolve(false)),
    membre: (discordId, contenu) => messagePrive(discordId, contenu),
  };

  async function membreDuServeur(discordId) {
    if (!serveur) return null;
    try { return await serveur.members.fetch(discordId); } catch { return null; }
  }

  async function donnerRole(discordId, roleId) {
    const m = roleId && await membreDuServeur(discordId);
    if (m && !m.roles.cache.has(roleId)) await m.roles.add(roleId, 'Overmaxx : accès payé');
  }

  async function estGoat(discordId) {
    const m = config.discord.roleGoat && await membreDuServeur(discordId);
    return Boolean(m && m.roles.cache.has(config.discord.roleGoat));
  }

  // ---------- Renouvellements ----------
  async function renouvellements() {
    const now = maintenant();
    for (const m of q.actifsAvecDiscord.all()) {
      const restant = new Date(m.acces_jusqu_au) - now;
      if (restant <= 0) continue;
      const o = config.offres[m.programme];

      if (m.programme === 'elite' && !m.categorie_elite && !(await estGoat(m.discord_id))) {
        if (restant <= 10 * JOUR_MS) await alerteElite(m);
        continue; // un Elite non classé ne reçoit pas de rappel de paiement
      }

      const palier = [...PALIERS_JOURS].reverse().find((p) => restant <= p * JOUR_MS);
      if (!palier) continue;
      const cle = (p) => `renouv:${m.id}:${m.acces_jusqu_au}:${p}`;
      if (dejaEnvoye(cle(palier))) continue;
      const prix = formatPrix(m.prix_renouvellement || o.prixRenouvellement, m.devise || config.devise);
      const lien = lienRenouvellement(config, m.programme, m.email);
      let texte = palier === 1
        ? `**Dernières 24 heures** pour renouveler ton accès à **${o.nom}** (fin le ${formatDate(m.acces_jusqu_au)}).\n`
          + `Renouvelle maintenant pour **${prix}** : ${lien}\n\n`
          + `Sans renouvellement, ton accès sera coupé et tu seras retiré du Discord. Pour revenir, il faudra repayer le prix d'entrée (**${formatPrix(o.prixEntree, config.devise)}**).`
        : `Ton accès à **${o.nom}** se termine dans **${palier} jours** (le ${formatDate(m.acces_jusqu_au)}).\n`
          + `Renouvelle-le quand tu veux d'ici là pour **${prix}** : ${lien}`;
      if (m.programme === 'elite' && m.categorie_elite === 'inconstant') {
        texte += '\n\nRappel : pour continuer l\'accompagnement, la caution de 60 € tous les 3 mois est obligatoire.';
      }
      if (await notifier.membre(m.discord_id, texte)) {
        for (const p of PALIERS_JOURS) if (p >= palier) marquer(cle(p));
        log(`rappel ${palier} j envoyé au membre ${m.id}`);
      }
    }
  }

  async function alerteElite(m) {
    const cle = `elite-alerte:${m.id}:${m.acces_jusqu_au}`;
    if (dejaEnvoye(cle)) return;
    const boutons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`elite:insatisfait:${m.id}`).setLabel('Insatisfait : prolonger 3 mois').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`elite:inconstant:${m.id}`).setLabel('Inconstant : caution 60 €').setStyle(ButtonStyle.Danger),
    );
    const ok = await notifier.admin({
      content: `**${m.nom}** (<@${m.discord_id}>, ${m.email}) sort de l'**Elite** le **${formatDate(m.acces_jusqu_au)}**.\n`
        + 'Classe son profil :\n- **Insatisfait** : il n\'a pas encore eu ses résultats, il continue 3 mois gratuitement ;\n'
        + '- **Inconstant** : il n\'a pas travaillé, je lui annonce la fin et la caution de 60 € pour continuer.',
      components: [boutons],
    });
    if (ok) marquer(cle);
  }

  // ---------- Expirations ----------
  async function expirations() {
    const now = maintenant();
    for (const m of q.expires.all(now.toISOString())) {
      if (q.expirer.run(now.toISOString(), m.id).changes !== 1) continue;
      const o = config.offres[m.programme];
      log(`accès expiré : membre ${m.id} (${m.programme})`);
      if (m.programme === 'elite' && m.discord_id) coaching.supprimerMembre(m.discord_id);
      if (!m.discord_id) {
        await notifier.admin(`Accès **${o.nom}** expiré pour ${m.nom} (${m.email}) : aucun compte Discord relié.`);
        continue;
      }
      const retour = m.programme === 'community'
        ? `Pour revenir, il faudra repayer l'entrée : ${lienInscription(config, 'community')}`
        : 'Pour revenir dans l\'accompagnement, contacte-nous.';
      await notifier.membre(m.discord_id, `Ton accès à **${o.nom}** est terminé, car il n'a pas été renouvelé. ${retour}`);
      const autres = q.autresActifs.all(m.discord_id, m.id);
      const membreDiscord = await membreDuServeur(m.discord_id);
      try {
        if (membreDiscord && m.discord_id !== config.discord.adminId) {
          if (autres.length) {
            if (o.roleDiscord) await membreDiscord.roles.remove(o.roleDiscord, 'Overmaxx : accès expiré');
          } else {
            await membreDiscord.kick(`Overmaxx : accès ${o.nom} non renouvelé`);
          }
        }
      } catch (err) {
        console.error(`[bob] retrait du membre ${m.id} impossible :`, err.message);
      }
      await notifier.admin(`**${m.nom}** (<@${m.discord_id}>) : accès **${o.nom}** expiré, ${autres.length ? 'rôle retiré' : 'retiré du serveur'}.`);
    }
  }

  // ---------- Rôles ----------
  async function synchroRoles() {
    for (const m of q.actifsAvecDiscord.all()) {
      try { await donnerRole(m.discord_id, config.offres[m.programme].roleDiscord); } catch (err) { console.warn('[bob] rôle :', err.message); }
    }
  }

  // ---------- Coaching ----------
  async function rappelsCoaching() {
    const now = maintenant();
    const aujourdhui = dateISO(now);
    const seances = coaching.occurrences(aujourdhui, ajouterJours(aujourdhui, 1)).filter((s) => s.debut > now);
    const salon = config.discord.salonCoaching ? `\nSalon vocal : ${config.discord.salonCoaching}` : '';

    for (const s of seances) {
      const avant = s.debut - now;
      const membre = q.membresParDiscord.all(s.discordId).find((m) => m.programme === 'elite');
      const perso = (membre && membre.rappel_coaching_min) || 240;
      const quand = `${JOURS[(s.debut.getUTCDay() + 6) % 7].toLowerCase()} à **${s.heure} GMT**`;
      const clePerso = `coach-perso:${s.date}:${s.heure}:${s.discordId}`;
      const cleAuto = `coach-1h:${s.date}:${s.heure}:${s.discordId}`;
      if (avant <= perso * 60 * 1000 && avant > 60 * 60 * 1000 && !dejaEnvoye(clePerso)) {
        if (await notifier.membre(s.discordId, `Rappel : ta séance de coaching privé est ${quand}.${salon}`)) marquer(clePerso);
      }
      if (avant <= 60 * 60 * 1000 && !dejaEnvoye(cleAuto)) {
        if (await notifier.membre(s.discordId, `Ta séance de coaching privé commence dans **1 heure** (${s.heure} GMT).${salon}`)) marquer(cleAuto);
      }
    }

    // Admin : 2 h avant la première séance de chaque jour.
    const parJour = new Map();
    for (const s of seances) if (!parJour.has(s.date)) parJour.set(s.date, s);
    for (const [date, premiere] of parJour) {
      const cle = `coach-admin:${date}`;
      if (premiere.debut - now > config.coaching.rappelAdminHeures * 3600 * 1000 || dejaEnvoye(cle)) continue;
      const duJour = seances.filter((s) => s.date === date);
      const ok = await notifier.admin(`**${duJour.length} séance(s) de coaching** aujourd'hui, la première à **${premiere.heure} GMT**.\n`
        + `Consulte le calendrier : ${config.baseUrl}/admin`);
      if (ok) marquer(cle);
    }
  }

  // ---------- Interactions ----------
  async function surInteraction(i) {
    const estAdmin = i.user.id === config.discord.adminId;
    if (i.isButton() && i.customId.startsWith('elite:')) {
      if (!estAdmin) return i.reply({ content: 'Réservé à l\'admin.', flags: MessageFlags.Ephemeral });
      const [, choix, id] = i.customId.split(':');
      const m = commandes.membreParId(Number(id));
      if (!m) return i.reply({ content: 'Membre introuvable.', flags: MessageFlags.Ephemeral });
      q.categoriser.run(choix, maintenant().toISOString(), m.id);
      if (choix === 'insatisfait') {
        const maj = commandes.prolongerGratuitement(m.id, config.offres.elite.dureeJours);
        await notifier.membre(m.discord_id, `Bonne nouvelle : ton accompagnement **Elite** continue gratuitement jusqu'au **${formatDate(maj.acces_jusqu_au)}**. On va chercher tes résultats ensemble.`);
        return i.update({ content: `${i.message.content}\n\n**Insatisfait** : prolongé jusqu'au ${formatDate(maj.acces_jusqu_au)}.`, components: [] });
      }
      await notifier.membre(m.discord_id,
        `Ton accompagnement **Elite** s'arrête le **${formatDate(m.acces_jusqu_au)}**, car les engagements n'ont pas été respectés.\n`
        + `Pour continuer, une caution de **${formatPrix(m.prix_renouvellement || config.offres.elite.prixRenouvellement, config.devise)}** est demandée tous les 3 mois : ${lienRenouvellement(config, 'elite', m.email)}\n`
        + 'Sans paiement avant cette date, l\'accompagnement s\'arrête ici.');
      return i.update({ content: `${i.message.content}\n\n**Inconstant** : prévenu, lien de caution envoyé.`, components: [] });
    }

    if (!i.isChatInputCommand()) return;
    if (!estAdmin) return i.reply({ content: 'Commande réservée à l\'admin.', flags: MessageFlags.Ephemeral });

    if (i.commandName === 'lien-elite') {
      const { lien } = commandes.creerInvitation(i.options.getString('note'));
      return i.reply({ content: `Lien de paiement Elite **personnel et à usage unique** :\n${lien}`, flags: MessageFlags.Ephemeral });
    }
    if (i.commandName === 'prolonger') {
      const u = i.options.getUser('membre', true);
      const jours = i.options.getInteger('jours', true);
      const programme = i.options.getString('offre') || 'community';
      const m = q.membresParDiscord.all(u.id).find((x) => x.programme === programme);
      if (!m) return i.reply({ content: `Aucun accès ${programme} relié à ${u}.`, flags: MessageFlags.Ephemeral });
      const maj = commandes.prolongerGratuitement(m.id, jours);
      await notifier.membre(u.id, `Ton accès à **${config.offres[programme].nom}** est prolongé jusqu'au **${formatDate(maj.acces_jusqu_au)}**.`);
      return i.reply({ content: `${u} prolongé jusqu'au ${formatDate(maj.acces_jusqu_au)}.`, flags: MessageFlags.Ephemeral });
    }
    if (i.commandName === 'membre') {
      const u = i.options.getUser('membre', true);
      const liste = q.membresParDiscord.all(u.id);
      if (!liste.length) return i.reply({ content: `${u} n'a aucun accès mobile money relié.`, flags: MessageFlags.Ephemeral });
      const lignes = liste.map((m) => `- **${config.offres[m.programme].nom}** : ${m.statut === 'actif' ? 'actif' : 'expiré'} jusqu'au ${formatDate(m.acces_jusqu_au)} · ${m.email}`
        + ` · renouvellement ${formatPrix(m.prix_renouvellement, m.devise || config.devise)}${m.categorie_elite ? ` · ${m.categorie_elite}` : ''}`);
      return i.reply({ content: `${u}\n${lignes.join('\n')}`, flags: MessageFlags.Ephemeral });
    }
    return undefined;
  }

  const COMMANDES = [
    new SlashCommandBuilder().setName('lien-elite').setDescription('Créer un lien de paiement Elite personnel (usage unique)')
      .addStringOption((o) => o.setName('note').setDescription('Pour qui (pseudo, prénom…)').setMaxLength(100))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('prolonger').setDescription('Prolonger gratuitement l\'accès d\'un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('jours').setDescription('Nombre de jours').setRequired(true).setMinValue(1).setMaxValue(365))
      .addStringOption((o) => o.setName('offre').setDescription('Offre').addChoices({ name: 'Community', value: 'community' }, { name: 'Elite', value: 'elite' }))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('membre').setDescription('Voir l\'accès mobile money d\'un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map((c) => c.toJSON());

  // ---------- Boucle ----------
  let tour = 0;
  let enCours = false;
  async function cycle() {
    if (enCours) return;
    enCours = true;
    try {
      await expirations();
      await renouvellements();
      await rappelsCoaching();
      if (tour++ % 10 === 0) await synchroRoles();
    } catch (err) {
      console.error('[bob] cycle :', err);
    } finally { enCours = false; }
  }

  return {
    notifier,
    cycle,
    surInteraction,
    COMMANDES,
    expirations,
    renouvellements,
    rappelsCoaching,

    async demarrer() {
      if (!actif) { log('désactivé : DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID manquant.'); return; }
      client.on('interactionCreate', (i) => surInteraction(i).catch((e) => console.error('[bob] interaction :', e)));
      client.once('clientReady', async () => {
        log(`connecté en tant que ${client.user.tag}`);
        try {
          serveur = await client.guilds.fetch(config.discord.serveurId);
          await serveur.commands.set(COMMANDES);
        } catch (err) { console.error('[bob] serveur Discord introuvable ou commandes refusées :', err.message); }
        cycle();
        setInterval(cycle, 60 * 1000).unref();
      });
      await client.login(config.discord.jetonBot);
    },

    // Après la connexion Discord d'un membre payé.
    async bienvenue(membre) {
      const o = config.offres[membre.programme];
      await notifier.membre(membre.discord_id, `Bienvenue dans **${o.nom}** ! Je suis **Bob**, le bot d'Overmaxx.\n`
        + `Ton accès est valable jusqu'au **${formatDate(membre.acces_jusqu_au)}**. Je te préviendrai avant la fin pour le renouveler.`);
    },

    async recapCoaching(discordId, reservations, decales) {
      const lignes = reservations.map((r) => `- ${JOURS[r.jour]} à ${r.heure} GMT`).join('\n');
      const d = decales.length
        ? `\n\nRéservé après 11h00 GMT pour aujourd'hui : ${decales.map((x) => `${JOURS[x.jour]} ${x.heure}`).join(', ')} ne compte qu'à partir de la semaine prochaine.`
        : '';
      await notifier.membre(discordId, `Tes créneaux de coaching sont enregistrés :\n${lignes}${d}\n\nPour les modifier : ${config.baseUrl}/coaching`);
    },

    async annulation(discordId, seance, justification) {
      const m = q.membresParDiscord.all(discordId).find((x) => x.programme === 'elite');
      await notifier.admin(`**Séance annulée** : ${(m && m.nom) || `<@${discordId}>`} (<@${discordId}>), le ${seance.date} à ${seance.heure} GMT.\nJustification : ${justification}`);
    },

    async candidature(champs) {
      const lignes = champs.map((c) => `**${c.label}** : ${c.valeur}`).join('\n').slice(0, 1900);
      await notifier.admin(`**Nouvelle candidature Elite**\n${lignes}\n\nSi tu retiens ce profil : contacte-le, puis tape \`/lien-elite\` pour lui créer son lien de paiement.`);
    },
  };
}

module.exports = { creerBob, formatPrix, PALIERS_JOURS };

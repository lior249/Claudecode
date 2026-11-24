'use strict';

const {
  Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType,
} = require('discord.js');

const STATUTS_CANDIDATURE_PROTEGES = ['examen', 'retenu', 'video', 'valide'];
const { lienRenouvellement, lienInscription, lienMagique } = require('./liens');
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
function creerBob({ config, db, commandes, coaching, candidatures, maintenant = () => new Date(), client: clientInjecte, serveur: serveurInjecte } = {}) {
  const actif = config.discordActif || Boolean(clientInjecte);
  const client = clientInjecte || (actif ? new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel],
  }) : null);

  const q = {
    deja: db.prepare('SELECT 1 FROM envois WHERE cle = ?'),
    marquer: db.prepare('INSERT OR IGNORE INTO envois (cle, envoye_le) VALUES (?, ?)'),
    actifsAvecDiscord: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL"),
    finis: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND acces_jusqu_au <= ?"),
    actifsEnCours: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL AND acces_jusqu_au > ?"),
    expirer: db.prepare("UPDATE membres SET statut = 'expire', maj_le = ? WHERE id = ? AND statut = 'actif'"),
    autresActifs: db.prepare("SELECT * FROM membres WHERE discord_id = ? AND statut = 'actif' AND id != ?"),
    categoriser: db.prepare('UPDATE membres SET categorie_elite = ?, maj_le = ? WHERE id = ?'),
    membresParDiscord: db.prepare('SELECT * FROM membres WHERE discord_id = ?'),
    enPeriodeAttente: db.prepare("SELECT 1 FROM membres WHERE discord_id = ? AND statut = 'actif' AND acces_jusqu_au <= ?"),
    attenteDepuis: db.prepare('SELECT envoye_le FROM envois WHERE cle = ?'),
    noterAttente: db.prepare('INSERT INTO envois (cle, envoye_le) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET envoye_le = excluded.envoye_le'),
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
  async function retirerRole(discordId, roleId) {
    const m = roleId && await membreDuServeur(discordId);
    if (m && m.roles.cache.has(roleId)) await m.roles.remove(roleId, 'Overmaxx');
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
          + (o.graceJours
            ? `Sans renouvellement, tu passes **en attente** : plus d'accès à la formation ni aux salons. Tu auras ${o.graceJours} jours pour renouveler à ce prix, puis tu seras retiré du Discord et il faudra repayer le prix d'entrée (**${formatPrix(o.prixEntree, config.devise)}**).`
            : `Sans renouvellement, ton accès sera coupé et tu seras retiré du Discord. Pour revenir, il faudra repayer le prix d'entrée (**${formatPrix(o.prixEntree, config.devise)}**).`)
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
  // Community : à la fin, 15 jours « en attente » (rôle Attente, plus de rôle Community, accès Whop coupé par le site),
  // renouvellement encore possible ; ensuite retrait du serveur. Elite : retrait immédiat.
  async function expirations() {
    const now = maintenant();
    for (const m of q.finis.all(now.toISOString())) {
      const o = config.offres[m.programme];
      const finAttente = new Date(m.acces_jusqu_au).getTime() + (o.graceJours || 0) * JOUR_MS;
      if (now.getTime() < finAttente) await mettreEnAttente(m, o, finAttente);
      else await retirer(m, o);
    }
  }

  async function mettreEnAttente(m, o, finAttente) {
    const cle = `attente:${m.id}:${m.acces_jusqu_au}`;
    const lien = lienRenouvellement(config, m.programme, m.email);
    const prix = formatPrix(m.prix_renouvellement || o.prixRenouvellement, m.devise || config.devise);
    if (!dejaEnvoye(cle)) {
      marquer(cle);
      log(`membre ${m.id} en attente jusqu'au ${new Date(finAttente).toISOString()}`);
      if (!m.discord_id) {
        await notifier.admin(`**${m.nom}** (${m.email}) est en attente (${o.nom}) : aucun compte Discord relié.`);
        return;
      }
      try {
        await retirerRole(m.discord_id, o.roleDiscord);
        await donnerRole(m.discord_id, config.discord.roleAttente);
      } catch (err) { console.error(`[bob] mise en attente du membre ${m.id} :`, err.message); }
      await notifier.membre(m.discord_id, `Ton accès à **${o.nom}** est terminé : tu es maintenant **en attente**. `
        + `Tu n'as plus accès à la formation ni aux salons.\n`
        + `Tu as jusqu'au **${formatDate(new Date(finAttente).toISOString())}** pour renouveler au même prix (**${prix}**) : ${lien}\n`
        + `Après cette date, tu seras retiré du Discord et il faudra repayer le prix d'entrée.`);
      await notifier.admin(`**${m.nom}** (<@${m.discord_id}>) passe **en attente** (${o.nom}) jusqu'au ${formatDate(new Date(finAttente).toISOString())}.`);
      return;
    }
    // Dernier rappel 3 jours avant le retrait.
    const cleRappel = `attente-rappel:${m.id}:${m.acces_jusqu_au}`;
    if (m.discord_id && finAttente - maintenant().getTime() <= 3 * JOUR_MS && !dejaEnvoye(cleRappel)) {
      if (await notifier.membre(m.discord_id, `Plus que **3 jours** pour renouveler ton accès à **${o.nom}** (${prix}) avant d'être retiré du Discord : ${lien}`)) {
        marquer(cleRappel);
      }
    }
  }

  async function retirer(m, o) {
    const now = maintenant();
    if (q.expirer.run(now.toISOString(), m.id).changes !== 1) return;
    log(`accès expiré : membre ${m.id} (${m.programme})`);
    if (m.programme === 'elite' && m.discord_id) coaching.supprimerMembre(m.discord_id);
    if (!m.discord_id) {
      await notifier.admin(`Accès **${o.nom}** expiré pour ${m.nom} (${m.email}) : aucun compte Discord relié.`);
      return;
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
          if (o.roleDiscord) await retirerRole(m.discord_id, o.roleDiscord);
          if (config.discord.roleAttente) await retirerRole(m.discord_id, config.discord.roleAttente);
        } else {
          await membreDiscord.kick(`Overmaxx : accès ${o.nom} non renouvelé`);
        }
      }
    } catch (err) {
      console.error(`[bob] retrait du membre ${m.id} impossible :`, err.message);
    }
    await notifier.admin(`**${m.nom}** (<@${m.discord_id}>) : accès **${o.nom}** expiré, ${autres.length ? 'rôle retiré' : 'retiré du serveur'}.`);
  }

  // ---------- Rôles ----------
  // Accès en cours : rôle de l'offre présent, rôle Attente retiré (par exemple juste après un renouvellement).
  async function synchroRoles() {
    for (const m of q.actifsEnCours.all(maintenant().toISOString())) {
      try {
        await donnerRole(m.discord_id, config.offres[m.programme].roleDiscord);
        await retirerRole(m.discord_id, config.discord.roleAttente);
      } catch (err) { console.warn('[bob] rôle :', err.message); }
    }
  }

  // ---------- Coaching ----------
  // Libère les créneaux de ceux qui n'ont plus le rôle Elite (fin d'abonnement Whop, passage GOAT, départ du serveur).
  async function libererCreneaux() {
    if (!serveur) return;
    for (const id of coaching.reserveurs()) {
      if (id === config.discord.adminId) continue;
      const m = await membreDuServeur(id);
      const eliteOk = m && m.roles.cache.has(config.offres.elite.roleDiscord) && !(config.discord.roleGoat && m.roles.cache.has(config.discord.roleGoat));
      if (eliteOk) continue;
      const n = coaching.supprimerMembre(id);
      if (!n) continue;
      const nom = (coaching.profil(id) || {}).pseudo || id;
      log(`créneaux de ${nom} libérés (${n})`);
      await notifier.admin(`Créneaux de coaching de **${nom}** (<@${id}>) libérés : il n'a plus le rôle Elite${m && config.discord.roleGoat && m.roles.cache.has(config.discord.roleGoat) ? ' (passé GOAT)' : ''}.`);
      if (m) await notifier.membre(id, 'Tes créneaux de coaching privé ont été libérés, car tu n\'as plus le rôle Elite.');
    }
  }

  async function rappelsCoaching() {
    const now = maintenant();
    const aujourdhui = dateISO(now);
    const seances = coaching.occurrences(aujourdhui, ajouterJours(aujourdhui, 1)).filter((s) => s.debut > now);
    const salon = config.discord.salonCoaching ? `\nSalon vocal : ${config.discord.salonCoaching}` : '';

    for (const s of seances) {
      const avant = s.debut - now;
      const profil = coaching.profil(s.discordId);
      const perso = (profil && profil.rappel_min) || 240;
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
  // ---------- Connexion au site par Bob ----------
  const pseudoDe = (u) => u.globalName || u.username;

  async function liensConnexion(user) {
    const u = { id: user.id, pseudo: pseudoDe(user) };
    const m = await membreDuServeur(user.id);
    const roles = m ? m.roles.cache : { has: () => false };
    const lignes = [];
    const eliteOk = roles.has(config.offres.elite.roleDiscord) && !(config.discord.roleGoat && roles.has(config.discord.roleGoat));
    if (user.id === config.discord.adminId) {
      lignes.push(`**Espace admin** : ${lienMagique(config, u, '/admin')}`);
      lignes.push(`**Candidatures** : ${lienMagique(config, u, '/admin/candidatures')}`);
    }
    if (eliteOk || user.id === config.discord.adminId) lignes.push(`**Réserver mes coachings** : ${lienMagique(config, u, '/coaching')}`);
    if (!eliteOk) lignes.push(`**Candidature Elite** : ${lienMagique(config, u, `${config.offres.elite.base}/candidature`)}`);
    return `Tes liens de connexion à overmaxx.online (personnels, valables **10 minutes**, ne les partage pas) :\n${lignes.join('\n')}`;
  }

  async function postuler(i) {
    const m = await membreDuServeur(i.user.id);
    const aUnAcces = m && Object.values(config.offres).some((o) => o.roleDiscord && m.roles.cache.has(o.roleDiscord));
    try {
      if (m && !aUnAcces && config.discord.roleAttente) {
        await donnerRole(i.user.id, config.discord.roleAttente);
        q.noterAttente.run(`attente-depuis:${i.user.id}`, maintenant().toISOString());
      }
    } catch (err) { console.warn('[bob] postuler :', err.message); }
    if (candidatures) candidatures.demarrer(i.user.id, pseudoDe(i.user));
    const lien = lienMagique(config, { id: i.user.id, pseudo: pseudoDe(i.user) }, `${config.offres.elite.base}/candidature`);
    return i.reply({ content: `Voici ton lien de candidature **Elite** (personnel, valable 10 minutes) :\n${lien}\n\nTu y remplis le formulaire. Je te réponds ici, en message privé, sous 24 heures.`, flags: MessageFlags.Ephemeral });
  }

  function messageBouton(type) {
    return type === 'attente'
        ? {
          content: '**Tu es en attente.**\n'
            + 'Pour accéder au serveur, tu dois être membre de l\'un des deux programmes : **Overmaxx Community** ou **Overmaxx Elite**.\n'
            + `Sans action de ta part, ce rôle te sera retiré d'ici **${config.discord.attenteNouveauxHeures || 24} heures** et tu quitteras le serveur.\n\n`
            + '*Membre Community dont l\'accès vient de se terminer ?* Tu as reçu ton lien de renouvellement en message privé : '
            + `tu as ${config.offres.community.graceJours} jours pour renouveler au même prix.`,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Rejoindre la Community').setStyle(ButtonStyle.Link).setURL(`${config.baseUrl}/community`),
            new ButtonBuilder().setCustomId('ovx:postuler').setLabel('Postuler à l\'Elite').setStyle(ButtonStyle.Primary),
          )],
        }
        : type === 'postuler'
        ? { content: '**Candidature Overmaxx Elite**\nClique sur le bouton : je t\'envoie ton lien personnel pour remplir le formulaire, sans mot de passe.',
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ovx:postuler').setLabel('Postuler').setStyle(ButtonStyle.Primary))] }
        : { content: '**Se connecter à overmaxx.online**\nClique sur le bouton : je t\'envoie ton lien personnel (coaching, candidature…), sans mot de passe.',
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ovx:connexion').setLabel('Se connecter au site').setStyle(ButtonStyle.Primary))] };
  }

  // ---------- Salon d'attente : seul salon visible pour le rôle En Attente ----------
  const cleSalonAttente = 'config:salon-attente';
  const salonAttenteId = () => (q.attenteDepuis.get(cleSalonAttente) || {}).envoye_le || null;

  async function bloquerPourAttente(salon) {
    const role = config.discord.roleAttente;
    if (!role || !salon || salon.id === salonAttenteId()) return 'ignoré';
    // Un salon synchronisé avec sa catégorie hérite du blocage de la catégorie : on ne le touche pas.
    if (salon.parentId && salon.permissionsLocked) return 'hérité';
    await salon.permissionOverwrites.edit(role, { ViewChannel: false }, { reason: 'Overmaxx : En Attente ne voit que le salon d\'attente' });
    return 'bloqué';
  }

  async function configurerAttente(salonChoisi) {
    const role = config.discord.roleAttente;
    if (!serveur || !role) return { erreur: 'DISCORD_ROLE_ATTENTE ou le serveur est introuvable.' };
    let salon = salonChoisi;
    // Automatique : salon déjà configuré, ou salon indiqué dans overmaxx.env.
    for (const id of [salonAttenteId(), config.discord.salonAttente]) {
      if (salon || !id) continue;
      try { salon = await serveur.channels.fetch(id); } catch { /* supprimé : on en recréera un */ }
    }
    if (!salon) {
      salon = await serveur.channels.create({
        name: 'en-attente',
        type: ChannelType.GuildText,
        position: 0,
        permissionOverwrites: [
          { id: serveur.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ],
        reason: 'Overmaxx : salon d\'attente',
      });
    } else {
      if (salon.parentId && salon.permissionsLocked && salon.lockPermissions) await salon.edit({ lockPermissions: false });
      await salon.permissionOverwrites.edit(role, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false });
    }
    q.noterAttente.run(cleSalonAttente, salon.id);

    const bilan = { bloques: 0, herites: 0, echecs: [] };
    const tous = await serveur.channels.fetch();
    // Catégories d'abord : leurs salons synchronisés héritent du blocage.
    const liste = [...tous.values()].filter(Boolean).sort((a, b) => (a.type === ChannelType.GuildCategory ? -1 : 0) - (b.type === ChannelType.GuildCategory ? -1 : 0));
    for (const c of liste) {
      if (c.id === salon.id) continue;
      try {
        const r = await bloquerPourAttente(c);
        if (r === 'bloqué') bilan.bloques++; else if (r === 'hérité') bilan.herites++;
      } catch (err) { bilan.echecs.push(c.name || c.id); }
    }
    // Le message n'est publié qu'une fois par salon.
    const cleMessage = `config:message-attente:${salon.id}`;
    if (!dejaEnvoye(cleMessage)) { await salon.send(messageBouton('attente')); marquer(cleMessage); }
    log(`salon d'attente configuré : ${salon.id} (${bilan.bloques} bloqués, ${bilan.herites} hérités, ${bilan.echecs.length} échecs)`);
    return { ok: true, salon, ...bilan };
  }

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

    if (i.isButton() && i.customId.startsWith('cand:')) {
      if (!estAdmin) return i.reply({ content: 'Réservé à l\'admin.', flags: MessageFlags.Ephemeral });
      const [, decision, id] = i.customId.split(':');
      const r = await appliquerDecision(Number(id), decision);
      if (r.erreur) return i.reply({ content: r.erreur, flags: MessageFlags.Ephemeral });
      const libelle = { retenir: 'Retenu : étape vidéo envoyée', refuser: 'Refusé', valider: 'Validé : lien de paiement envoyé' }[decision];
      return i.update({ content: `${i.message.content}\n\n**${libelle}**.`, components: [] });
    }

    if (i.isButton() && i.customId === 'ovx:postuler') return postuler(i);
    if (i.isButton() && i.customId === 'ovx:connexion') return i.reply({ content: await liensConnexion(i.user), flags: MessageFlags.Ephemeral });

    if (!i.isChatInputCommand()) return;

    // Commandes ouvertes à tous
    if (i.commandName === 'connexion') return i.reply({ content: await liensConnexion(i.user), flags: MessageFlags.Ephemeral });
    if (i.commandName === 'lier') {
      const membre = commandes.lierParCode(i.options.getString('code', true), i.user.id, pseudoDe(i.user));
      if (!membre) return i.reply({ content: 'Code inconnu. Vérifie le code affiché sur ta page après le paiement (6 lettres et chiffres).', flags: MessageFlags.Ephemeral });
      const o = config.offres[membre.programme];
      try {
        if (membre.statut === 'actif') { await donnerRole(i.user.id, o.roleDiscord); await retirerRole(i.user.id, config.discord.roleAttente); }
      } catch (err) { console.warn('[bob] /lier :', err.message); }
      return i.reply({ content: `C'est fait : ton compte est relié à **${o.nom}**, accès valable jusqu'au **${formatDate(membre.acces_jusqu_au)}**. Ton rôle est ajouté. Je te préviendrai avant la fin pour le renouveler.`, flags: MessageFlags.Ephemeral });
    }

    if (!estAdmin) return i.reply({ content: 'Commande réservée à l\'admin.', flags: MessageFlags.Ephemeral });

    if (i.commandName === 'configurer-attente') {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await configurerAttente(i.options.getChannel('salon'));
      if (r.erreur) return i.editReply(r.erreur);
      return i.editReply(`Salon d'attente : <#${r.salon.id}>. ${r.bloques} salon(s) ou catégorie(s) bloqué(s) pour En Attente, `
        + `${r.herites} salon(s) synchronisé(s) avec leur catégorie.`
        + (r.echecs.length ? `\nImpossible de modifier : ${r.echecs.join(', ')}. Donne à Bob l'accès à ces salons, puis relance la commande.` : '')
        + '\nLes nouveaux salons seront bloqués automatiquement.');
    }

    if (i.commandName === 'publier') {
      const contenu = messageBouton(i.options.getString('bouton', true));
      await i.channel.send(contenu);
      return i.reply({ content: 'Bouton publié dans ce salon.', flags: MessageFlags.Ephemeral });
    }

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
    new SlashCommandBuilder().setName('connexion').setDescription('Recevoir ton lien de connexion à overmaxx.online (sans mot de passe)'),
    new SlashCommandBuilder().setName('lier').setDescription('Relier ton paiement mobile money à ton compte Discord')
      .addStringOption((o) => o.setName('code').setDescription('Le code affiché après ton paiement').setRequired(true).setMinLength(6).setMaxLength(6)),
    new SlashCommandBuilder().setName('configurer-attente').setDescription('Salon d\'attente : seul salon visible pour le rôle En Attente')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon d\'attente existant (sinon Bob en crée un)').addChannelTypes(ChannelType.GuildText))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('publier').setDescription('Publier un bouton de Bob dans ce salon')
      .addStringOption((o) => o.setName('bouton').setDescription('Quel bouton').setRequired(true)
        .addChoices(
          { name: 'Message du salon d\'attente (Community + Postuler)', value: 'attente' },
          { name: 'Postuler (candidature Elite)', value: 'postuler' },
          { name: 'Se connecter au site', value: 'connexion' },
        ))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

  // ---------- Candidatures Elite ----------
  const lienCandidature = () => `${config.baseUrl}${config.offres.elite.base}/candidature`;
  const boutonsCandidature = (id, decisions) => new ActionRowBuilder().addComponents(decisions.map((d) => new ButtonBuilder()
    .setCustomId(`cand:${d}:${id}`)
    .setLabel({ retenir: 'Retenir', refuser: 'Refuser', valider: 'Valider' }[d])
    .setStyle(d === 'refuser' ? ButtonStyle.Danger : ButtonStyle.Success)));

  async function appliquerDecision(id, decision) {
    const r = candidatures.decider(id, decision);
    if (r.erreur) return r;
    const c = r.candidature;
    if (decision === 'retenir') {
      await notifier.membre(c.discord_id, '**Bonne nouvelle : ton profil a été retenu pour l\'Elite !**\n'
        + 'Dernière étape : envoie une **vidéo d\'1 minute** pour te présenter. '
        + `Tout se passe ici : ${lienCandidature()}`);
    } else if (decision === 'valider') {
      await notifier.membre(c.discord_id, '**Ta candidature Elite est validée. Bienvenue !** 🎉\n'
        + `Confirme ton intégration en réglant l'accompagnement avec ton lien personnel : ${candidatures.lienPaiement(c)}`);
    } else {
      await notifier.membre(c.discord_id, 'Merci pour ta candidature. Après examen, **ton profil n\'a pas été retenu** pour l\'Elite cette fois-ci. '
        + 'Tu peux continuer à progresser avec la Community.');
      // Il ne garde pas l'accès au salon d'attente s'il n'a rien d'autre sur le serveur.
      const m = await membreDuServeur(c.discord_id);
      const ids = !m ? [] : typeof m.roles.cache.keys === 'function' ? [...m.roles.cache.keys()] : [...(m.roles.cache.set || [])];
      const autres = ids.filter((r) => r !== config.discord.roleAttente && r !== (serveur && serveur.id)); // sans @everyone
      try {
        if (m && config.discord.roleAttente && m.roles.cache.has(config.discord.roleAttente)) {
          if (autres && autres.length) await m.roles.remove(config.discord.roleAttente, 'Candidature refusée');
          else await m.kick('Candidature Elite refusée');
        }
      } catch (err) { console.warn('[bob] refus candidature :', err.message); }
    }
    log(`candidature ${c.id} : ${decision}`);
    return r;
  }

  async function candidatureRecue(c, champs) {
    await notifier.membre(c.discord_id, '**Ton formulaire de candidature Elite est bien reçu.** Il est en cours de traitement : '
      + `je te réponds ici dans les 24 heures. Tu peux aussi suivre l'avancement sur ${lienCandidature()}`);
    const lignes = champs.map((x) => `**${x.label}** : ${x.valeur}`).join('\n').slice(0, 1700);
    await notifier.admin({
      content: `**Nouvelle candidature Elite** : ${c.pseudo || ''} (<@${c.discord_id}>)\n${lignes}`,
      components: [boutonsCandidature(c.id, ['retenir', 'refuser'])],
    });
  }

  async function videoRecue(c) {
    await notifier.membre(c.discord_id, 'Ta vidéo est bien reçue. Je te donne la réponse finale ici très bientôt.');
    await notifier.admin({
      content: `**Vidéo de candidature reçue** : ${c.pseudo || ''} (<@${c.discord_id}>).\nRegarde-la ici : ${config.baseUrl}/admin/candidatures`,
      components: [boutonsCandidature(c.id, ['valider', 'refuser'])],
    });
  }

  // ---------- Rôle En Attente temporaire ----------
  // Un nouveau venu « En Attente » qui n'a rejoint aucun programme est retiré du serveur après 24 h.
  // Exceptions : candidature Elite en cours, membre Community dans sa période d'attente, admin, bots.
  async function nettoyerAttente() {
    const role = config.discord.roleAttente;
    if (!serveur || !role) return;
    const delai = (config.discord.attenteNouveauxHeures || 24) * 3600 * 1000;
    const now = maintenant();
    let tous;
    try { tous = await serveur.members.fetch(); } catch (err) { console.warn('[bob] liste des membres :', err.message); return; }
    for (const m of tous.values()) {
      if (!m.roles.cache.has(role) || m.user?.bot || m.id === config.discord.adminId) continue;
      const aUnAcces = Object.values(config.offres).some((o) => o.roleDiscord && m.roles.cache.has(o.roleDiscord))
        || (config.discord.roleGoat && m.roles.cache.has(config.discord.roleGoat));
      if (aUnAcces) {
        // Il a payé un programme (par exemple par carte sur Whop) : il n'est plus en attente.
        try { await m.roles.remove(role, 'Overmaxx : membre d\'un programme'); log(`rôle En Attente retiré à ${m.id} (membre d'un programme)`); } catch (err) { console.warn('[bob] retrait En Attente :', err.message); }
        continue;
      }
      if (q.enPeriodeAttente.get(m.id, now.toISOString())) continue;
      const c = candidatures && candidatures.parDiscord(m.id);
      if (c && STATUTS_CANDIDATURE_PROTEGES.includes(c.statut)) continue;
      const note = q.attenteDepuis.get(`attente-depuis:${m.id}`);
      const depuis = Math.max(m.joinedTimestamp || 0, note ? new Date(note.envoye_le).getTime() : 0);
      if (!depuis || now.getTime() - depuis < delai) continue;
      await notifier.membre(m.id, 'Tu étais **en attente** sur le serveur Overmaxx depuis 24 heures sans rejoindre de programme : '
        + 'ton accès est retiré. Tu peux revenir à tout moment avec le lien d\'invitation'
        + `${config.lienDiscord ? ` (${config.lienDiscord})` : ''}, puis rejoindre la Community (${config.baseUrl}/community) ou postuler à l'Elite.`);
      try {
        await m.kick('Overmaxx : en attente depuis plus de 24 h sans programme');
        log(`retiré après 24 h en attente : ${m.id}`);
      } catch (err) { console.warn(`[bob] retrait de ${m.id} impossible :`, err.message); }
    }
  }

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
      if (tour % 2 === 0) await synchroRoles();
      if (tour % 10 === 0) await nettoyerAttente();
      if (tour++ % 10 === 0) await libererCreneaux();
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
    synchroRoles,
    renouvellements,
    rappelsCoaching,
    libererCreneaux,
    nettoyerAttente,
    configurerAttente,
    bloquerPourAttente,

    async demarrer() {
      if (!actif) { log('désactivé : DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID manquant.'); return; }
      client.on('interactionCreate', (i) => surInteraction(i).catch((e) => console.error('[bob] interaction :', e)));
      client.on('channelCreate', (c) => {
        if (!c.guild || c.guild.id !== config.discord.serveurId || !salonAttenteId()) return;
        bloquerPourAttente(c).catch((e) => console.warn('[bob] nouveau salon :', e.message));
      });
      client.once('clientReady', async () => {
        log(`connecté en tant que ${client.user.tag}`);
        try {
          serveur = await client.guilds.fetch(config.discord.serveurId);
          await serveur.commands.set(COMMANDES);
        } catch (err) { console.error('[bob] serveur Discord introuvable ou commandes refusées :', err.message); }
        // Salon d'attente configuré automatiquement à chaque démarrage (aucune commande à taper).
        if (serveur && config.discord.roleAttente) {
          try {
            const r = await configurerAttente(null);
            if (r.ok) {
              const nouveau = !dejaEnvoye(`config:bilan:${r.salon.id}`);
              if (nouveau || r.echecs.length) {
                marquer(`config:bilan:${r.salon.id}`);
                await notifier.admin(`Salon d'attente prêt : <#${r.salon.id}>. ${r.bloques} salon(s) ou catégorie(s) cachés au rôle En Attente.`
                  + (r.echecs.length ? `\nJe n'ai pas pu modifier : ${r.echecs.join(', ')}. Donne-moi l'accès à ces salons (ou « Gérer les salons »), puis relance le site.` : ''));
              }
            } else console.warn('[bob] salon d\'attente :', r.erreur);
          } catch (err) { console.error('[bob] salon d\'attente :', err.message); }
        }
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

    appliquerDecision,
    candidatureRecue,
    videoRecue,

    async candidature(champs) {
      const lignes = champs.map((c) => `**${c.label}** : ${c.valeur}`).join('\n').slice(0, 1900);
      await notifier.admin(`**Nouvelle candidature Elite**\n${lignes}\n\nSi tu retiens ce profil : contacte-le, puis tape \`/lien-elite\` pour lui créer son lien de paiement.`);
    },
  };
}

module.exports = { creerBob, formatPrix, PALIERS_JOURS };

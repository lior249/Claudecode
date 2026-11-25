'use strict';

const {
  Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, AuditLogEvent,
} = require('discord.js');

const STATUTS_CANDIDATURE_PROTEGES = ['examen', 'retenu', 'video', 'valide'];
const { lienRenouvellement, lienMagique } = require('./liens');
const { JOURS, dateISO, ajouterJours, aHeure, lundiDe } = require('./coaching');
const { jourLisible } = require('./suivi');
const { nomRole, nomCourt, ROLES: ROLES_DISCORD } = require('./roles');
const { creerAccesManuels } = require('./acces-manuels');

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
function creerBob({ config, db, commandes, coaching, candidatures, parcours, suivi, sinistres, push, accesManuels, maintenant = () => new Date(),
  attendre = (ms) => new Promise((r) => setTimeout(r, ms)), client: clientInjecte, serveur: serveurInjecte } = {}) {
  const acces = accesManuels || creerAccesManuels({ db, parcours, coaching, maintenant });
  const actif = config.discordActif || Boolean(clientInjecte);
  const client = clientInjecte || (actif ? new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.GuildMember],
  }) : null);

  const q = {
    deja: db.prepare('SELECT 1 FROM envois WHERE cle = ?'),
    marquer: db.prepare('INSERT OR IGNORE INTO envois (cle, envoye_le) VALUES (?, ?)'),
    actifsAvecDiscord: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL"),
    // Elite : paiement unique, personne n'est retiré à la fin des 90 jours.
    finis: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND programme != 'elite' AND acces_jusqu_au <= ?"),
    actifsEnCours: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL AND acces_jusqu_au > ?"),
    expirer: db.prepare("UPDATE membres SET statut = 'expire', maj_le = ? WHERE id = ? AND statut = 'actif'"),
    autresActifs: db.prepare("SELECT * FROM membres WHERE discord_id = ? AND statut = 'actif' AND id != ?"),
    membresParDiscord: db.prepare('SELECT * FROM membres WHERE discord_id = ?'),
    enPeriodeAttente: db.prepare("SELECT 1 FROM membres WHERE discord_id = ? AND statut = 'actif' AND acces_jusqu_au <= ?"),
    attenteDepuis: db.prepare('SELECT envoye_le FROM envois WHERE cle = ?'),
    noterAttente: db.prepare('INSERT INTO envois (cle, envoye_le) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET envoye_le = excluded.envoye_le'),
    payeeParCarte: db.prepare('UPDATE invitations_elite SET utilisee_le = ?, ref_commande = ? WHERE token = ? AND utilisee_le IS NULL'),
    carte: db.prepare('SELECT * FROM abonnes_carte WHERE discord_id = ? AND programme = ?'),
    carteNouveau: db.prepare('INSERT INTO abonnes_carte (discord_id, programme, pseudo, depuis) VALUES (?, ?, ?, ?)'),
    carteRetour: db.prepare('UPDATE abonnes_carte SET perdu_le = NULL, termine_le = NULL, pseudo = COALESCE(?, pseudo) WHERE discord_id = ? AND programme = ?'),
    cartesActives: db.prepare('SELECT * FROM abonnes_carte WHERE programme = ? AND perdu_le IS NULL AND termine_le IS NULL'),
    cartesPerdues: db.prepare('SELECT * FROM abonnes_carte WHERE programme = ? AND perdu_le IS NOT NULL AND termine_le IS NULL'),
    cartePerdue: db.prepare('UPDATE abonnes_carte SET perdu_le = ? WHERE discord_id = ? AND programme = ?'),
    carteTerminee: db.prepare('UPDATE abonnes_carte SET termine_le = ? WHERE discord_id = ? AND programme = ?'),
    sansAccesWhop: db.prepare("SELECT * FROM membres WHERE statut = 'actif' AND whop_membership_id IS NULL AND acces_jusqu_au > ?"),
    membreParId: db.prepare('SELECT * FROM membres WHERE id = ?'),
    dernierPaiement: db.prepare("SELECT ref, type, payee_le FROM commandes WHERE programme = ? AND email = ? AND statut = 'PAYEE' ORDER BY payee_le DESC LIMIT 1"),
  };
  const dejaEnvoye = (cle) => Boolean(q.deja.get(cle));
  const marquer = (cle) => q.marquer.run(cle, maintenant().toISOString());

  let serveur = serveurInjecte || null;
  const log = (...a) => console.log('[bob]', ...a);

  // ---------- Envois ----------
  // Message avec des boutons-liens (jamais de longs liens bruts dans le texte).
  function avecBoutons(texte, boutons) {
    const valides = boutons.filter((b) => b && b.url && b.url.length <= 512 && /^https?:\/\//.test(b.url));
    if (!valides.length) return { content: texte };
    const rangees = [];
    for (let k = 0; k < valides.length && k < 25; k += 5) {
      rangees.push(new ActionRowBuilder().addComponents(valides.slice(k, k + 5)
        .map((b) => new ButtonBuilder().setLabel(b.label.slice(0, 80)).setStyle(ButtonStyle.Link).setURL(b.url))));
    }
    return { content: texte, components: rangees };
  }

  // Après validation : les deux moyens de paiement, au même prix.
  function boutonsPaiementElite(c) {
    return [
      { label: 'Payer par mobile money', url: lienPerso(c.discord_id, c.pseudo, new URL(candidatures.lienPaiement(c)).pathname) },
      { label: 'Payer par carte bancaire', url: config.offres.elite.lienCarte },
    ];
  }

  const dernieresErreurs = new Map();
  async function messagePrive(discordId, contenu) {
    if (!client || !client.isReady()) return false;
    try {
      const u = await client.users.fetch(discordId);
      const msg = await u.send(typeof contenu === 'string' ? { content: contenu } : contenu);
      return { url: msg && msg.channelId ? `https://discord.com/channels/@me/${msg.channelId}` : 'https://discord.com/channels/@me' };
    } catch (err) {
      dernieresErreurs.set(discordId, err.message);
      console.warn(`[bob] message privé impossible à ${discordId} : ${err.message}`);
      return false;
    }
  }
  // ---------- Fil privé : quand le message privé ne passe pas ----------
  // Bob ouvre un fil privé (visible seulement par la personne et les modérateurs) et y met le même message, avec les mêmes boutons.
  // Salon d'attente si la personne le voit, sinon le premier salon qu'elle voit. Un seul fil par personne et par salon, réutilisé.
  const DROITS_FIL = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePrivateThreads];
  async function moiSurLeServeur() {
    if (serveur.members.me) return serveur.members.me;
    try { return serveur.members.fetchMe ? await serveur.members.fetchMe() : null; } catch { return null; }
  }
  async function salonPourFil(m) {
    const moi = await moiSurLeServeur();
    const convient = (c) => c && c.type === ChannelType.GuildText && c.threads && typeof c.permissionsFor === 'function'
      && Boolean(c.permissionsFor(m)?.has(PermissionFlagsBits.ViewChannel))
      && (!moi || Boolean(c.permissionsFor(moi)?.has(DROITS_FIL)));
    const idAttente = salonAttenteId();
    if (idAttente) {
      try { const s = await serveur.channels.fetch(idAttente); if (convient(s)) return s; } catch { /* salon supprimé */ }
    }
    const tous = await serveur.channels.fetch();
    return [...tous.values()].filter(convient).sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))[0] || null;
  }
  const horsDuServeur = new Set();
  async function filPrive(discordId, contenu) {
    if (!serveur) return false;
    try {
      let m = null;
      try { m = await serveur.members.fetch(discordId); } catch { m = null; }
      if (!m) { horsDuServeur.add(discordId); return false; }
      horsDuServeur.delete(discordId);
      const salon = await salonPourFil(m);
      if (!salon) throw new Error('aucun salon où je peux ouvrir un fil privé (il me faut « Créer des fils privés » et « Envoyer des messages dans les fils »)');
      const cle = `fil:${discordId}:${salon.id}`;
      let fil = null;
      const connu = q.attenteDepuis.get(cle);
      if (connu) { try { fil = await serveur.channels.fetch(connu.envoye_le); } catch { fil = null; } }
      if (!fil) {
        fil = await salon.threads.create({
          name: `Bob · ${(m.user?.globalName || m.user?.username || 'membre').slice(0, 60)}`,
          type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 10080, reason: 'Overmaxx : message privé impossible',
        });
        q.noterAttente.run(cle, fil.id);
      }
      if (fil.archived && fil.setArchived) await fil.setArchived(false);
      await fil.members.add(discordId); // de nouveau à chaque fois : il a pu quitter le serveur et revenir
      const message = typeof contenu === 'string' ? { content: contenu } : { ...contenu };
      message.content = `<@${discordId}> ${message.content || ''}`.slice(0, 2000);
      await fil.send(message);
      log(`message envoyé dans le fil privé de ${discordId} (#${salon.name || salon.id})`);
      return { url: `https://discord.com/channels/${serveur.id}/${fil.id}` };
    } catch (err) {
      dernieresErreurs.set(discordId, err.message);
      console.warn(`[bob] fil privé impossible pour ${discordId} : ${err.message}`);
      return false;
    }
  }

  // ---------- Application Overmaxx : le même message en notification ----------
  // Titre : la première partie en gras ; texte : le reste, sans mise en forme Discord ; lien : le premier bouton.
  function versPush(contenu) {
    const texte = typeof contenu === 'string' ? contenu : String((contenu && contenu.content) || '');
    const liens = ((contenu && contenu.components) || []).flatMap((r) => (r.components || []).map((b) => b.data && b.data.url)).filter(Boolean);
    const propre = (t) => t.replace(/<@!?\d+>/g, '').replace(/<#\d+>/g, '#salon').replace(/\*\*|__|`|\*/g, '').replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
    const gras = texte.match(/\*\*([^*]+?)\*\*/);
    const enTete = gras && texte.trim().startsWith(gras[0]);
    const titre = enTete ? propre(gras[1]).replace(/[\s.:!]+$/, '') : 'Overmaxx';
    const corps = propre(enTete ? texte.replace(gras[0], '') : texte).replace(/^[\s:.,-]+/, '') || titre;
    return { titre: titre.slice(0, 90), corps: corps.slice(0, 240), url: liens[0] || `${config.baseUrl}/app` };
  }
  // Boutons d'action (Valider, Confirmer…) : ils n'existent que dans Discord, ces messages restent sur Bob.
  const aDesBoutonsAction = (contenu) => Boolean(contenu && contenu.components
    && contenu.components.some((r) => (r.components || []).some((b) => b.data && b.data.custom_id)));
  async function parApplication(discordId, contenu) {
    if (!push || !discordId || aDesBoutonsAction(contenu) || push.canal(discordId) !== 'app') return false;
    try { return (await push.envoyer(discordId, versPush(contenu))) > 0; } catch (err) { console.warn('[push]', err.message); return false; }
  }
  const notifier = {
    // Selon son choix : l'application, ou Bob. Si aucun appareil ne répond, Bob prend le relais.
    admin: async (contenu) => (config.discord.adminId ? ((await parApplication(config.discord.adminId, contenu)) || messagePrive(config.discord.adminId, contenu)) : false),
    // Message privé, sinon fil privé avec les mêmes boutons. Si rien ne passe, l'admin le sait (une fois par jour et par membre).
    membre: async (discordId, contenu) => (await parApplication(discordId, contenu)) || (await envoyer(discordId, contenu)).ok,
    // Rappels de paiement : toujours par Bob, puis par l'application 10 minutes plus tard, s'il n'a toujours pas payé.
    paiement: async (discordId, contenu, { membreId, accesAvant } = {}) => {
      const ok = (await envoyer(discordId, contenu)).ok;
      if (!push || !push.abonnements(discordId).length) return ok;
      push.differer(discordId, versPush(contenu), { minutes: 10, membreId, accesAvant });
      return true;
    },
  };
  // Notifications différées (rappels de paiement) : envoyées dans l'application si l'accès n'a pas été prolongé entre-temps.
  async function notificationsDifferees() {
    if (!push) return;
    for (const d of push.dues()) {
      const m = d.membre_id ? q.membreParId.get(d.membre_id) : null;
      if (d.membre_id && (!m || m.acces_jusqu_au !== d.acces_avant)) { push.marquerDifferee(d.id, 'payé entre-temps'); continue; }
      const n = await push.envoyer(d.discord_id, { titre: d.titre, corps: d.corps, url: d.url, tag: `paiement-${d.membre_id || d.id}` });
      push.marquerDifferee(d.id, n ? `envoyé (${n})` : 'aucun appareil');
    }
  }
  async function envoyer(discordId, contenu) {
    const r = (await messagePrive(discordId, contenu)) || (await filPrive(discordId, contenu));
    if (r) return { ok: true, url: r.url };
    const cle = `mp-ferme:${discordId}:${maintenant().toISOString().slice(0, 10)}`;
    if (!dejaEnvoye(cle) && config.discord.adminId && discordId !== config.discord.adminId) {
      marquer(cle);
      const horsServeur = horsDuServeur.has(discordId) || /mutual guild/i.test(dernieresErreurs.get(discordId) || '');
      await messagePrive(config.discord.adminId, horsServeur
        ? `Je n'arrive pas à écrire à <@${discordId}> : **il n'est pas (ou plus) sur le serveur**. Il doit le rejoindre pour recevoir mes messages.`
        : `Je n'arrive pas à écrire à <@${discordId}> : ses messages privés sont fermés et je n'ai pas pu ouvrir de fil privé.\n`
          + `Raison : ${dernieresErreurs.get(discordId) || 'inconnue'}`);
    }
    return { ok: false };
  }
  // Bouton personnel : ouvre le site déjà connecté avec ce compte Discord.
  const lienPerso = (id, pseudo, retour) => lienMagique(config, { id, pseudo }, retour);
  const lienRenouvellementPerso = (m) => (m.discord_id
    ? lienPerso(m.discord_id, m.discord_pseudo, `${config.offres[m.programme].base}/renouveler`)
    : lienRenouvellement(config, m.programme, m.email));

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

  // ---------- Renouvellements ----------
  async function renouvellements() {
    const now = maintenant();
    for (const m of q.actifsAvecDiscord.all()) {
      const restant = new Date(m.acces_jusqu_au) - now;
      if (restant <= 0) continue;
      const o = config.offres[m.programme];

      if (m.programme === 'elite') continue; // Elite : paiement unique, rien à renouveler

      const palier = [...PALIERS_JOURS].reverse().find((p) => restant <= p * JOUR_MS);
      if (!palier) continue;
      const cle = (p) => `renouv:${m.id}:${m.acces_jusqu_au}:${p}`;
      if (dejaEnvoye(cle(palier))) continue;
      const prix = formatPrix(m.prix_renouvellement || o.prixRenouvellement, m.devise || config.devise);
      const lien = lienRenouvellementPerso(m);
      let texte = palier === 1
        ? `**Dernières 24 heures** pour renouveler ton accès à **${o.nom}** (fin le ${formatDate(m.acces_jusqu_au)}).\n`
          + `Renouvelle maintenant pour **${prix}**.\n\n`
          + (o.graceJours
            ? `Sans renouvellement, tu passes **en attente** : plus d'accès à la formation ni aux salons. Tu auras ${o.graceJours} jours pour renouveler à ce prix, puis tu seras retiré du Discord et il faudra repayer le prix d'entrée (**${formatPrix(o.prixEntree, config.devise)}**).`
            : `Sans renouvellement, ton accès sera coupé et tu seras retiré du Discord. Pour revenir, il faudra repayer le prix d'entrée (**${formatPrix(o.prixEntree, config.devise)}**).`)
        : `Ton accès à **${o.nom}** se termine dans **${palier} jours** (le ${formatDate(m.acces_jusqu_au)}).\n`
          + `Renouvelle-le quand tu veux d'ici là pour **${prix}**.`;
      if (await notifier.paiement(m.discord_id, avecBoutons(texte, [{ label: 'Renouveler mon accès', url: lien }]), { membreId: m.id, accesAvant: m.acces_jusqu_au })) {
        for (const p of PALIERS_JOURS) if (p >= palier) marquer(cle(p));
        log(`rappel ${palier} j envoyé au membre ${m.id}`);
      }
    }
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
    const lien = lienRenouvellementPerso(m);
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
      await notifier.paiement(m.discord_id, avecBoutons(`Ton accès à **${o.nom}** est terminé : tu es maintenant **en attente**. `
        + `Tu n'as plus accès à la formation ni aux salons.\n`
        + `Tu as jusqu'au **${formatDate(new Date(finAttente).toISOString())}** pour renouveler au même prix (**${prix}**).\n`
        + `Après cette date, tu seras retiré du Discord et il faudra repayer le prix d'entrée.`, [{ label: 'Renouveler mon accès', url: lien }]), { membreId: m.id, accesAvant: m.acces_jusqu_au });
      await notifier.admin(`**${m.nom}** (<@${m.discord_id}>) passe **en attente** (${o.nom}) jusqu'au ${formatDate(new Date(finAttente).toISOString())}.`);
      return;
    }
    // Dernier rappel 3 jours avant le retrait.
    const cleRappel = `attente-rappel:${m.id}:${m.acces_jusqu_au}`;
    if (m.discord_id && finAttente - maintenant().getTime() <= 3 * JOUR_MS && !dejaEnvoye(cleRappel)) {
      if (await notifier.paiement(m.discord_id, avecBoutons(`Plus que **3 jours** pour renouveler ton accès à **${o.nom}** (${prix}) avant d'être retiré du Discord.`, [{ label: 'Renouveler mon accès', url: lien }]), { membreId: m.id, accesAvant: m.acces_jusqu_au })) {
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
    const retour = m.programme === 'community' ? 'Pour revenir, il faudra repayer l\'entrée.' : 'Pour revenir dans l\'accompagnement, contacte-nous.';
    await notifier.membre(m.discord_id, avecBoutons(`Ton accès à **${o.nom}** est terminé, car il n'a pas été renouvelé. ${retour}`,
      m.programme === 'community' ? [{ label: 'Revenir dans la Community', url: lienPerso(m.discord_id, m.discord_pseudo, '/community') }] : []));
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
  const estSinistre = (id) => Boolean(parcours && (parcours.get(id) || {}).sinistre_depuis);
  async function synchroRoles() {
    for (const m of q.actifsEnCours.all(maintenant().toISOString())) {
      if (m.programme === 'elite' && estSinistre(m.discord_id)) continue; // rôle Elite retiré pendant le sinistre
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
    const boutonSalon = config.discord.salonCoaching ? [{ label: 'Rejoindre le salon vocal', url: config.discord.salonCoaching }] : [];

    for (const s of seances) {
      if (s.touchee) continue; // annulée par le coach (absence ou imprévu)
      const avant = s.debut - now;
      const profil = coaching.profil(s.discordId);
      const perso = (profil && profil.rappel_min) || 240;
      const quand = `**${quandLocal(s.discordId, s.debut)}**`;
      const clePerso = `coach-perso:${s.date}:${s.heure}:${s.discordId}`;
      const cleAuto = `coach-1h:${s.date}:${s.heure}:${s.discordId}`;
      if (avant <= perso * 60 * 1000 && avant > 60 * 60 * 1000 && !dejaEnvoye(clePerso)) {
        if (await notifier.membre(s.discordId, avecBoutons(`Rappel : ta séance de coaching privé est ${quand}.`, boutonSalon))) marquer(clePerso);
      }
      if (avant <= 60 * 60 * 1000 && !dejaEnvoye(cleAuto)) {
        if (await notifier.membre(s.discordId, avecBoutons(`Ta séance de coaching privé commence dans **1 heure** (${heureLocale(s.discordId, s.debut)}).`, boutonSalon))) marquer(cleAuto);
      }
    }

    // Admin : 2 h avant la première séance de chaque jour.
    const parJour = new Map();
    for (const s of seances) if (!parJour.has(s.date)) parJour.set(s.date, s);
    for (const [date, premiere] of parJour) {
      const cle = `coach-admin:${date}`;
      if (premiere.debut - now > config.coaching.rappelAdminHeures * 3600 * 1000 || dejaEnvoye(cle)) continue;
      const duJour = seances.filter((s) => s.date === date && !s.touchee);
      if (!duJour.length) { marquer(cle); continue; }
      const ok = await notifier.admin(avecBoutons(`**${duJour.length} séance(s) de coaching** aujourd'hui, la première à **${duJour[0].heure} GMT**.`,
        [{ label: 'Ouvrir le calendrier', url: lienCoach(`/admin?semaine=${date}`) }, { label: 'J\'ai un imprévu', url: lienCoach(`/admin/imprevu?date=${date}`) }]));
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
    const boutons = [];
    const eliteOk = roles.has(config.offres.elite.roleDiscord) && !(config.discord.roleGoat && roles.has(config.discord.roleGoat));
    // Le coach (admin) : seulement son espace, ni réservation de coaching ni candidature Elite.
    if (user.id === config.discord.adminId) {
      return avecBoutons('Tes accès à overmaxx.online (personnels, ne les partage pas) :', [
        { label: 'Espace admin', url: lienMagique(config, u, '/admin') },
        { label: 'Candidatures', url: lienMagique(config, u, '/admin/candidatures') },
        { label: 'Membres', url: lienMagique(config, u, '/admin/membres') },
      ]);
    }
    if (parcours && parcours.get(user.id)) boutons.push({ label: 'Mon parcours', url: lienMagique(config, u, '/parcours') });
    if (eliteOk) boutons.push({ label: 'Réserver mes coachings', url: lienMagique(config, u, '/coaching') });
    if (!eliteOk) boutons.push({ label: 'Candidature Elite', url: lienMagique(config, u, `${config.offres.elite.base}/candidature`) });
    return avecBoutons('Tes accès à overmaxx.online (personnels, ne les partage pas) :', boutons);
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
    return i.reply({ ...avecBoutons('Ta candidature **Elite** : remplis le formulaire. Je te réponds ici, en message privé, sous 24 heures.',
      [{ label: 'Postuler à l\'Elite', url: `${config.baseUrl}${config.offres.elite.base}` }]), flags: MessageFlags.Ephemeral });
  }

  function messageBouton(type) {
    return type === 'attente'
        ? {
          content: '**Tu es en attente.**\n'
            + 'Pour accéder au reste du serveur, rejoins l\'un des deux programmes : **Overmaxx Community** ou **Overmaxx Elite**.\n'
            + (config.discord.attenteNouveauxHeures
              ? `Sans action de ta part, ce rôle te sera retiré d'ici **${config.discord.attenteNouveauxHeures} heures** et tu quitteras le serveur.\n\n` : '\n')
            + 'Le plus simple : utilise les boutons du **message de bienvenue de Bob** (en privé ou dans ton fil **Bob**) : tu arrives sur le site déjà connecté.\n\n'
            + '*Membre Community dont l\'accès vient de se terminer ?* Tu as reçu ton lien de renouvellement en message privé : '
            + `tu as ${config.offres.community.graceJours} jours pour renouveler au même prix.`,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Rejoindre la Community').setStyle(ButtonStyle.Link).setURL(`${config.baseUrl}/community`),
            new ButtonBuilder().setLabel('Postuler à l\'Elite').setStyle(ButtonStyle.Link).setURL(`${config.baseUrl}${config.offres.elite.base}`),
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
    const cleMessage = `config:message-attente:v4:${salon.id}`;
    if (!dejaEnvoye(cleMessage)) {
      // Supprime l'ancienne version du message (bouton « Postuler » qui envoyait un lien) avant de republier.
      try {
        const recents = salon.messages ? await salon.messages.fetch({ limit: 30 }) : new Map();
        for (const msg of recents.values()) {
          if (msg.author && client.user && msg.author.id === client.user.id && /Tu es en attente/.test(msg.content || '')) await msg.delete();
        }
      } catch (err) { console.warn('[bob] ancien message d\'attente :', err.message); }
      await salon.send(messageBouton('attente'));
      marquer(cleMessage);
    }
    log(`salon d'attente configuré : ${salon.id} (${bilan.bloques} bloqués, ${bilan.herites} hérités, ${bilan.echecs.length} échecs)`);
    return { ok: true, salon, ...bilan };
  }

  // ---------- Salon #sinistrés : seul salon visible pour le rôle Sinistré ----------
  const cleSalonSinistres = 'config:salon-sinistres';
  const salonSinistresId = () => (q.attenteDepuis.get(cleSalonSinistres) || {}).envoye_le || null;
  async function bloquerPourSinistres(salon) {
    const role = config.discord.roleSinistre;
    if (!role || !salon || salon.id === salonSinistresId()) return 'ignoré';
    if (salon.parentId && salon.permissionsLocked) return 'hérité';
    await salon.permissionOverwrites.edit(role, { ViewChannel: false }, { reason: 'Overmaxx : un sinistré ne voit que #sinistrés' });
    return 'bloqué';
  }
  async function configurerSinistres() {
    const role = config.discord.roleSinistre;
    if (!serveur || !role) return { erreur: 'DISCORD_ROLE_SINISTRE ou le serveur est introuvable.' };
    let salon = null;
    for (const id of [salonSinistresId(), config.discord.salonSinistres]) {
      if (salon || !id) continue;
      try { salon = await serveur.channels.fetch(id); } catch { /* supprimé : on en recrée un */ }
    }
    if (!salon) {
      salon = await serveur.channels.create({
        name: 'sinistrés',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: serveur.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ],
        reason: 'Overmaxx : salon des sinistrés',
      });
    } else {
      if (salon.parentId && salon.permissionsLocked && salon.lockPermissions) await salon.edit({ lockPermissions: false });
      await salon.permissionOverwrites.edit(role, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false });
    }
    q.noterAttente.run(cleSalonSinistres, salon.id);
    const bilan = { bloques: 0, herites: 0, echecs: [] };
    const tous = await serveur.channels.fetch();
    const liste = [...tous.values()].filter(Boolean).sort((a, b) => (a.type === ChannelType.GuildCategory ? -1 : 0) - (b.type === ChannelType.GuildCategory ? -1 : 0));
    for (const c of liste) {
      if (c.id === salon.id) continue;
      try {
        const r = await bloquerPourSinistres(c);
        if (r === 'bloqué') bilan.bloques++; else if (r === 'hérité') bilan.herites++;
      } catch { bilan.echecs.push(c.name || c.id); }
    }
    const cleMessage = `config:message-sinistres:v1:${salon.id}`;
    if (!dejaEnvoye(cleMessage)) {
      await salon.send({
        content: '**Tu es sinistré.**\nTu as disparu du processus pendant plus de 7 jours sans prévenir : tu ne vois plus que ce salon et tu n\'as plus de coaching.\n\n'
          + 'Pour revenir : remplis ta **fiche de sinistre** (pourquoi tu étais absent, et tes engagements). Ton coach la lit et décide de ta réhabilitation.\n'
          + 'Tant qu\'elle n\'est pas remplie, chaque semaine d\'absence de plus compte comme un sinistre de plus. Au 3e : plus de live individuel.',
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Remplir ma fiche de sinistre').setStyle(ButtonStyle.Link).setURL(`${config.baseUrl}/sinistre`))],
      });
      marquer(cleMessage);
    }
    log(`salon des sinistrés configuré : ${salon.id} (${bilan.bloques} bloqués, ${bilan.herites} hérités, ${bilan.echecs.length} échecs)`);
    return { ok: true, salon, ...bilan };
  }

  async function surInteraction(i) {
    const estAdmin = i.user.id === config.discord.adminId;
    if (i.isButton() && i.customId.startsWith('cand:')) {
      if (!estAdmin) return i.reply({ content: 'Réservé à l\'admin.', flags: MessageFlags.Ephemeral });
      const [, decision, id] = i.customId.split(':');
      const r = await appliquerDecision(Number(id), decision);
      if (r.erreur) return i.reply({ content: r.erreur, flags: MessageFlags.Ephemeral });
      const libelle = { retenir: 'Retenu : étape vidéo envoyée', refuser: 'Refusé', valider: 'Validé : lien de paiement envoyé' }[decision];
      return i.update({ content: `${i.message.content}\n\n**${libelle}**.`, components: [] });
    }

    if (i.isButton() && i.customId.startsWith('recompense:')) {
      if (!estAdmin) return i.reply({ content: 'Réservé à l\'admin.', flags: MessageFlags.Ephemeral });
      const [, role, id] = i.customId.split(':');
      const r = suivi ? suivi.confirmerRecompense(id, role) : { erreur: 'Indisponible.' };
      if (r.erreur) return i.reply({ content: r.erreur, flags: MessageFlags.Ephemeral });
      await prevenirParcours.recompenseConfirmee(r.parcours, role);
      return i.update({ content: `${i.message.content}\n\n**Confirmé : rôle donné.**`, components: [] });
    }
    if (i.isButton() && i.customId.startsWith('acces:')) {
      if (!estAdmin) return i.reply({ content: 'Réservé à l\'admin.', flags: MessageFlags.Ephemeral });
      const [, choix, programme, id] = i.customId.split(':');
      const r = acces.decider(id, programme, choix === 'oui');
      if (r.erreur) return i.reply({ content: r.erreur, flags: MessageFlags.Ephemeral });
      await accesDecide(r);
      const fait = choix === 'oui' ? (r.ouvert ? 'Accès au site donné : je l\'ai prévenu.' : 'Accès au site gardé.') : (r.retire ? 'Accès au site retiré (son rôle Discord reste).' : 'Pas d\'accès au site (son rôle Discord reste).');
      return i.update({ content: `${i.message.content}\n\n**${fait}**`, components: [] });
    }
    if (i.isButton() && i.customId === 'ovx:postuler') return postuler(i);
    if (i.isButton() && i.customId === 'ovx:connexion') return i.reply({ ...(await liensConnexion(i.user)), flags: MessageFlags.Ephemeral });

    if (!i.isChatInputCommand()) return;

    // Commandes ouvertes à tous
    if (i.commandName === 'connexion') return i.reply({ ...(await liensConnexion(i.user)), flags: MessageFlags.Ephemeral });
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
      return i.reply({ ...avecBoutons('Lien de paiement Elite **personnel et à usage unique** : copie-le (appui long sur le bouton) et envoie-le à la personne.',
        [{ label: 'Lien de paiement Elite', url: lien }]), flags: MessageFlags.Ephemeral });
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

  // Bouton-lien vers la fiche du candidat sur l'espace admin (la décision se prend là-bas).
  const boutonFiche = (id) => new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setLabel('Voir la fiche sur Overmaxx').setStyle(ButtonStyle.Link).setURL(`${config.baseUrl}/admin/candidatures/${id}`));

  async function appliquerDecision(id, decision) {
    const r = candidatures.decider(id, decision);
    if (r.erreur) return r;
    const c = r.candidature;
    if (decision === 'retenir') {
      const lienSuite = lienMagique(config, { id: c.discord_id, pseudo: c.pseudo }, `${config.offres.elite.base}/candidature`);
      await notifier.membre(c.discord_id, avecBoutons('**Bonne nouvelle : ton profil a été retenu pour l\'Elite !**\nIl te reste une dernière étape.',
        [{ label: 'Continuer ma candidature', url: lienSuite }]));
    } else if (decision === 'valider') {
      await notifier.membre(c.discord_id, avecBoutons('**Ta candidature Elite est validée. Bienvenue !**\n'
        + 'Confirme ton intégration en réglant l\'accompagnement. Choisis ton moyen de paiement : le prix est le même.',
        boutonsPaiementElite(c)));
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

  // Pseudo Discord écrit dans le formulaire → identifiant du membre sur le serveur (les pseudos Discord sont uniques).
  async function idDepuisPseudo(saisie) {
    const pseudo = String(saisie || '').trim().replace(/^@/, '').toLowerCase();
    if (!serveur || pseudo.length < 2) return null;
    try {
      const trouves = await serveur.members.fetch({ query: pseudo, limit: 20 });
      const liste = [...trouves.values()];
      const exact = liste.find((m) => (m.user.username || '').toLowerCase() === pseudo)
        || liste.filter((m) => (m.user.globalName || '').toLowerCase() === pseudo || (m.nickname || '').toLowerCase() === pseudo);
      if (Array.isArray(exact)) return exact.length === 1 ? exact[0].id : null;
      return exact ? exact.id : null;
    } catch (err) {
      console.warn('[bob] recherche du pseudo :', err.message);
      return null;
    }
  }

  async function candidatureRecue(c, champs) {
    await notifier.membre(c.discord_id, '**Ton formulaire de candidature Elite est bien reçu.** Il est en cours de traitement : '
      + 'je te réponds ici, en message privé, dans les 24 heures.');
    const nom = (champs.find((x) => /nom/i.test(x.label) && !/discord/i.test(x.label)) || {}).valeur;
    await notifier.admin({
      content: `**Nouvelle candidature Elite** : ${nom ? `**${nom}** · ` : ''}${c.pseudo || ''} (<@${c.discord_id}>)\n`
        + 'Consulte sa fiche sur Overmaxx pour voir ses réponses, puis **retiens-le ou refuse-le depuis la plateforme**.',
      components: [boutonFiche(c.id)],
    });
  }

  async function videoRecue(c) {
    await notifier.membre(c.discord_id, 'Ta vidéo est bien reçue. Je te donne la réponse finale ici très bientôt.');
    await notifier.admin({
      content: `**Vidéo de candidature reçue** : ${c.pseudo || ''} (<@${c.discord_id}>).\n`
        + 'Regarde-la sur sa fiche Overmaxx, puis **valide ou refuse depuis la plateforme**.',
      components: [boutonFiche(c.id)],
    });
  }

  // ---------- Relances des candidats retenus qui n'ont pas encore continué ----------
  async function relancerCandidats() {
    if (!candidatures) return;
    const now = maintenant().getTime();
    for (const c of candidatures.liste()) {
      if (c.statut !== 'retenu' || !c.decision_le) continue;
      const depuis = now - new Date(c.decision_le).getTime();
      const palier = [72, 24].find((h) => depuis >= h * 3600 * 1000);
      if (!palier) continue;
      const cle = (h) => `relance-cand:${c.id}:${h}`;
      if (dejaEnvoye(cle(palier))) continue;
      const lien = lienMagique(config, { id: c.discord_id, pseudo: c.pseudo }, `${config.offres.elite.base}/candidature`);
      const texte = palier === 24
        ? 'Petit rappel : ton profil a été **retenu pour l\'Elite**, mais ta candidature n\'est pas terminée.'
        : 'Dernier rappel : il te reste la dernière étape de ta candidature **Elite**. Sans réponse de ta part, ta place pourra être proposée à quelqu\'un d\'autre.';
      if (await notifier.membre(c.discord_id, avecBoutons(texte, [{ label: 'Continuer ma candidature', url: lien }]))) {
        for (const h of [24, 72]) if (h <= palier) marquer(cle(h));
        log(`relance ${palier} h envoyée au candidat ${c.id}`);
      }
    }
  }

  // ---------- Accès Whop pas encore débloqué ----------
  // 1 h puis 24 h après le paiement, Bob rappelle l'étape Whop (avec l'email exact) et propose de corriger l'email.
  // 48 h après, l'admin est prévenu. Un seul message par palier, même si plusieurs sont dépassés.
  const PALIERS_WHOP = [[1, 'membre'], [24, 'membre'], [48, 'admin']];
  async function relancerWhop() {
    const now = maintenant();
    for (const m of q.sansAccesWhop.all(now.toISOString())) {
      const p = q.dernierPaiement.get(m.programme, m.email);
      if (!p || !p.payee_le) continue;
      const heures = (now - new Date(p.payee_le)) / 3600000;
      const atteints = PALIERS_WHOP.filter(([h]) => heures >= h);
      const cle = (h) => `relance-whop:${m.id}:${p.payee_le}:${h}`;
      const aEnvoyer = atteints.filter(([h]) => !dejaEnvoye(cle(h)));
      if (!aEnvoyer.length) continue;
      for (const [h] of atteints) marquer(cle(h));
      const o = config.offres[m.programme];
      const etapes = `${config.baseUrl}/${p.type === 'inscription' ? 'acces' : 'renouvele'}/${p.ref}`;
      if (aEnvoyer.some(([, qui]) => qui === 'admin')) {
        await notifier.admin(`**${m.nom}**${m.discord_id ? ` (<@${m.discord_id}>)` : ''} a payé **${o.nom}** il y a plus de 48 h mais n'a toujours pas son accès Whop. `
          + `Email du paiement : ${m.email}${m.email_whop ? ` · email Whop indiqué : ${m.email_whop}` : ''}.`);
      }
      if (m.discord_id && aEnvoyer.some(([, qui]) => qui === 'membre')) {
        await notifier.membre(m.discord_id, avecBoutons(`**Il te reste une étape pour accéder à la formation ${o.nom}.**\n`
          + `Je ne vois pas encore ta demande d'accès sur Whop. Ouvre l'offre et, à la question, réponds avec exactement cet email : **${m.email_whop || m.email}**\n`
          + 'Tu as donné un autre email à Whop ? Dis-le-moi avec le 2e bouton : je corrige tout seul.',
        [{ label: 'Voir les étapes', url: etapes },
          { label: 'J\'ai donné un autre email à Whop', url: lienPerso(m.discord_id, m.discord_pseudo, '/acces/email-whop') }]));
        log(`relance Whop envoyée au membre ${m.id}`);
      }
    }
  }

  // ---------- Membres payés par carte (Whop) ----------
  // Whop donne le rôle de l'offre à ceux qui paient par carte : Bob les repère (rôle sans paiement mobile money).
  // Pas de rappel avant la fin : la carte se renouvelle seule. Quand Whop retire le rôle (carte refusée, abonnement arrêté),
  // Bob prévient. Community : 15 jours En Attente, puis retrait du serveur (comme le mobile money). Elite : l'admin est prévenu.
  async function suivreCarte() {
    if (!serveur) return;
    let tous;
    try { tous = await serveur.members.fetch(); } catch (err) { console.warn('[bob] membres carte :', err.message); return; }
    const now = maintenant();
    const iso = now.toISOString();
    for (const o of Object.values(config.offres)) {
      if (!o.roleDiscord) continue;
      const payeMobile = (id) => payeMobileOffre(id, o.id);
      // 1. Rôle présent sans paiement mobile money : abonné par carte qui revient, ou question au coach (rôle donné à la main ?).
      for (const m of tous.values()) {
        if (m.roles.cache.has(o.roleDiscord)) await roleRecu(m, o);
      }
      // 2. Rôle retiré par Whop.
      for (const r of q.cartesActives.all(o.id)) {
        const m = tous.get(r.discord_id);
        if (m && m.roles.cache.has(o.roleDiscord)) continue;
        if (o.id === 'elite' && estSinistre(r.discord_id)) continue; // rôle retiré par Bob pendant le sinistre
        if (payeMobile(r.discord_id)) { q.carteTerminee.run(iso, r.discord_id, o.id); continue; } // passé au mobile money
        if (r.source === 'main') { q.carteTerminee.run(iso, r.discord_id, o.id); log(`rôle ${o.id} donné à la main retiré : ${r.discord_id}`); continue; } // retiré par le coach
        q.cartePerdue.run(iso, r.discord_id, o.id);
        log(`abonnement ${o.id} par carte arrêté : ${r.discord_id}`);
        if (!m) { q.carteTerminee.run(iso, r.discord_id, o.id); continue; } // parti du serveur
        if (o.id === 'elite') {
          await notifier.admin(`**${r.pseudo || r.discord_id}** (<@${r.discord_id}>) a perdu son rôle **${o.nom}**, donné par Whop (paiement par carte). Vérifie sur Whop.`);
          continue;
        }
        try { if (config.discord.roleAttente) await donnerRole(r.discord_id, config.discord.roleAttente); } catch (err) { console.warn('[bob] attente carte :', err.message); }
        await notifier.membre(r.discord_id, avecBoutons(`**Ton abonnement ${o.nom} par carte s'est arrêté** : le paiement n'est pas passé, ou l'abonnement a été annulé sur Whop.\n`
          + `Tu es maintenant **en attente** (plus d'accès aux salons). Tu as **${o.graceJours} jours** pour mettre à jour ta carte sur Whop, sinon tu seras retiré du serveur.`,
        [{ label: 'Ouvrir Whop', url: 'https://whop.com' }]));
        await notifier.admin(`**${r.pseudo || r.discord_id}** (<@${r.discord_id}>) : abonnement **${o.nom}** par carte arrêté, en attente ${o.graceJours} jours.`);
      }
      // 3. Fin de l'attente sans reprise : retrait du serveur (s'il n'a rien d'autre).
      if (!o.graceJours) continue;
      for (const r of q.cartesPerdues.all(o.id)) {
        if (now - new Date(r.perdu_le) < o.graceJours * JOUR_MS) continue;
        q.carteTerminee.run(iso, r.discord_id, o.id);
        const m = tous.get(r.discord_id);
        if (!m) continue;
        const autreAcces = Object.values(config.offres).some((x) => x.roleDiscord && m.roles.cache.has(x.roleDiscord))
          || q.membresParDiscord.all(r.discord_id).some((x) => x.statut === 'actif');
        if (autreAcces) { try { await retirerRole(r.discord_id, config.discord.roleAttente); } catch { /* rien */ } continue; }
        try { await m.kick(`Overmaxx : abonnement ${o.nom} par carte non repris`); } catch (err) { console.warn('[bob] retrait carte :', err.message); }
        await notifier.admin(`**${r.pseudo || r.discord_id}** (<@${r.discord_id}>) retiré du serveur : abonnement **${o.nom}** par carte non repris après ${o.graceJours} jours.`);
      }
    }
    await prevenirAcces();
  }

  // ---------- Rôles donnés à la main ----------
  // Quelqu'un reçoit le rôle d'un programme sans avoir payé sur le site. Le journal d'audit du serveur dit qui l'a donné :
  // le bot de Whop (paiement par carte) : accès au site comme avant ; une personne (le coach) : Bob lui demande Oui ou Non.
  const payeMobileOffre = (id, programme) => q.membresParDiscord.all(id).some((x) => x.programme === programme && x.statut === 'actif');
  let auditIndisponible = false;
  async function auteurDuRole(m, roleId) {
    if (!serveur || typeof serveur.fetchAuditLogs !== 'function') return null;
    for (const delai of [1500, 4000]) {
      await attendre(delai); // le journal d'audit est écrit juste après l'événement
      try {
        const journal = await serveur.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 25 });
        const depuis = maintenant().getTime() - 10 * 60 * 1000;
        const e = [...journal.entries.values()].find((x) => (x.targetId || x.target?.id) === m.id && x.createdTimestamp >= depuis
          && (x.changes || []).some((c) => c.key === '$add' && (c.new || []).some((r) => r.id === roleId)));
        if (e && e.executor) return { id: e.executor.id, bot: Boolean(e.executor.bot), pseudo: e.executor.globalName || e.executor.username || e.executor.id };
      } catch (err) {
        if (!auditIndisponible) console.warn('[bob] journal d\'audit illisible (permission « Voir les logs du serveur ») :', err.message);
        auditIndisponible = true;
        return null;
      }
    }
    return null;
  }

  // Le rôle de l'offre o est là. auteur : qui l'a donné (journal d'audit), ou undefined (repéré par le passage de Bob).
  async function roleRecu(m, o, { auteur } = {}) {
    if (!m || m.user?.bot || m.id === config.discord.adminId || !o.roleDiscord || !m.roles.cache.has(o.roleDiscord)) return null;
    if (payeMobileOffre(m.id, o.id)) return null;
    if (auteur && client.user && auteur.id === client.user.id) return null; // donné par Bob lui-même
    const pseudo = m.user?.username || null;
    const iso = maintenant().toISOString();
    const r = q.carte.get(m.id, o.id);
    if (r && !r.perdu_le && !r.termine_le) return null; // il a déjà accès au site
    // Donné par le bot de Whop : paiement par carte.
    if (auteur && auteur.bot) {
      acces.oublier(m.id, o.id);
      if (r) q.carteRetour.run(pseudo, m.id, o.id);
      else q.carteNouveau.run(m.id, o.id, pseudo, iso);
      db.prepare("UPDATE abonnes_carte SET source = 'whop' WHERE discord_id = ? AND programme = ?").run(m.id, o.id);
      log(`membre ${o.id} payé par carte (rôle donné par ${auteur.pseudo}) : ${m.id}`);
      if (o.id === 'elite' && parcours) parcours.assurer(m.id, { pseudo, entree: iso });
      return 'carte';
    }
    const a = acces.get(m.id, o.id);
    if (a && a.statut === 'accorde') { acces.rouvrir(m.id, o.id, pseudo); log(`accès ${o.id} donné à la main rouvert : ${m.id}`); return 'rouvert'; }
    if (a) return null; // déjà demandé (en attente) ou refusé
    // Ancien abonné par carte dont le rôle revient tout seul (carte mise à jour) : comme avant.
    if (r && !auteur) { q.carteRetour.run(pseudo, m.id, o.id); log(`abonnement ${o.id} par carte repris : ${m.id}`); return 'carte'; }
    acces.demander(m.id, o.id, { pseudo, donnePar: auteur ? auteur.pseudo : null });
    log(`rôle ${o.id} sans paiement sur le site : question au coach pour ${m.id}`);
    return 'question';
  }

  // Les questions au coach : une par message (Oui / Non). Beaucoup d'un coup (premier passage) : un seul message et la liste sur le site.
  const LIMITE_QUESTIONS = 5;
  function boutonsAcces(a) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`acces:oui:${a.programme}:${a.discord_id}`).setLabel(a.ancien ? 'Oui, il garde l\'accès' : 'Oui, donner l\'accès').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`acces:non:${a.programme}:${a.discord_id}`).setLabel(a.ancien ? 'Non, retirer l\'accès' : 'Non').setStyle(ButtonStyle.Danger));
  }
  function questionAcces(a) {
    const o = config.offres[a.programme] || { nom: a.programme };
    const qui = `**${a.pseudo || a.discord_id}** (<@${a.discord_id}>)`;
    if (a.ancien) {
      return `${qui} a le rôle **${o.nom}** sans avoir payé sur le site. Il a déjà accès au site (repéré avant la validation).\n`
        + 'Lui laisser l\'accès au site ?\nSi c\'est un paiement par carte sur Whop, ou s\'il t\'a déjà payé, réponds Oui.';
    }
    return `${qui} a reçu le rôle **${o.nom}** sans avoir payé sur le site${a.donne_par ? ` (rôle donné par **${a.donne_par}**)` : ''}.\n`
      + 'Lui donner accès au site quand même ?' + (a.donne_par ? '' : '\nSi c\'est un paiement par carte sur Whop, réponds Oui.');
  }
  async function prevenirAcces() {
    if (!config.discord.adminId) return 0;
    const liste = acces.aPrevenir().filter((a) => config.offres[a.programme]);
    if (!liste.length) return 0;
    if (liste.length > LIMITE_QUESTIONS) {
      const n = liste.length;
      const ok = await notifier.admin(avecBoutons(`**${n} personnes** ont un rôle Overmaxx sans avoir payé sur le site.\n`
        + 'Pour chacune, dis-moi si je lui ouvre le site : **Oui** ou **Non**. Ceux qui y avaient déjà accès le gardent en attendant ta réponse.',
      [{ label: 'Répondre', url: lienCoach('/admin/a-traiter#acces') }]));
      if (ok) for (const a of liste) acces.marquerPrevenu(a.discord_id, a.programme);
      return ok ? n : 0;
    }
    let n = 0;
    for (const a of liste) {
      if (await notifier.admin({ content: questionAcces(a), components: [boutonsAcces(a)] })) { acces.marquerPrevenu(a.discord_id, a.programme); n++; }
    }
    return n;
  }
  // Après la réponse du coach (sur Discord ou sur le site) : le membre apprend que son site est ouvert.
  async function accesDecide(r) {
    if (!r || !r.ok || !r.ouvert) return false;
    const a = r.acces;
    const o = config.offres[a.programme];
    const pseudo = a.pseudo || null;
    const ouvrir = lienPerso(a.discord_id, pseudo, '/app');
    return notifier.membre(a.discord_id, avecBoutons(`**Ton accès au site Overmaxx est ouvert** (${o ? o.nom : a.programme}).\n`
      + (a.programme === 'elite' ? 'Ton parcours de l\'accompagnement t\'y attend.' : 'Tu y retrouves tes notifications et le classement.'),
    [{ label: 'Ouvrir mon espace', url: ouvrir }]));
  }
  // Rôle d'un programme ajouté sur Discord (événement) : on regarde qui l'a donné, puis on décide.
  async function surRoleAjoute(avant, apres) {
    if (!apres || (apres.guild && apres.guild.id !== config.discord.serveurId) || avant?.partial) return;
    for (const o of Object.values(config.offres)) {
      if (!o.roleDiscord || !apres.roles.cache.has(o.roleDiscord) || (avant && avant.roles.cache.has(o.roleDiscord))) continue;
      if (apres.user?.bot || apres.id === config.discord.adminId || payeMobileOffre(apres.id, o.id)) continue;
      const auteur = await auteurDuRole(apres, o.roleDiscord);
      if ((await roleRecu(apres, o, { auteur: auteur || undefined })) === 'question') await prevenirAcces();
    }
  }

  // ---------- Parcours de l'accompagnement Elite ----------
  const ETAPES_NOMS = { 1: 'Prise en main', 2: 'Coaching d\'entrée', 3: 'Validation du contenu', 4: 'Publication et suivi', 5: 'GOAT' };
  const quoi = (s) => (s.etape === 1 ? `ton exercice ${s.emplacement}` : `ta vidéo ${s.emplacement.slice(1)}`);
  const lienCoach = (chemin) => lienPerso(config.discord.adminId, 'coach', chemin);
  const prevenirParcours = {
    // Le membre a envoyé un exercice ou une vidéo : le coach est prévenu.
    async envoiRecu(s, p) {
      if (!config.discord.adminId) return;
      await notifier.admin(avecBoutons(`**${(p && (p.nom || p.pseudo)) || s.discord_id}** (<@${s.discord_id}>) a envoyé ${s.etape === 1 ? `l'exercice ${s.emplacement}` : `la vidéo ${s.emplacement.slice(1)}`} (étape ${s.etape}).`,
        [{ label: 'Ouvrir', url: lienCoach(`/admin/envois/${s.id}`) }]));
    },
    // Décision du coach : le membre est prévenu, avec la suite.
    async decision(s, p, etapeSuivante) {
      if (s.etat === 'corriger') {
        await notifier.membre(s.discord_id, avecBoutons(`**Ton coach demande des modifications sur ${quoi(s)}.** Lis sa remarque, puis renvoie la nouvelle version : tu as **24 h**.`,
          [{ label: 'Voir sa remarque', url: lienPerso(s.discord_id, p && p.pseudo, `/parcours/etape-${s.etape}`) }]));
        return;
      }
      const suite = etapeSuivante
        ? `\n**Étape ${etapeSuivante} ouverte : ${ETAPES_NOMS[etapeSuivante]}.**${etapeSuivante === 2 ? ' Réserve ton coaching d\'entrée dans les 12 heures.' : etapeSuivante === 4 ? ' Tu es maintenant autorisé à publier.' : ''}`
        : '';
      await notifier.membre(s.discord_id, avecBoutons(`**${quoi(s).charAt(0).toUpperCase()}${quoi(s).slice(1)} est validé${s.etape === 3 ? 'e' : ''}.**${suite}`,
        [{ label: etapeSuivante && etapeSuivante <= 3 ? `Ouvrir l'étape ${etapeSuivante}` : 'Mon parcours', url: lienPerso(s.discord_id, p && p.pseudo, etapeSuivante && etapeSuivante <= 3 ? `/parcours/etape-${etapeSuivante}` : '/parcours') }]));
    },
    async remarque(p) {
      await notifier.membre(p.discord_id, avecBoutons('**Ton coach a ajouté une remarque sur ta fiche.**',
        [{ label: 'Lire la remarque', url: lienPerso(p.discord_id, p.pseudo, '/fiche#remarques') }]));
    },
    async etapeOuverte(p, n) {
      await notifier.membre(p.discord_id, avecBoutons(`**Étape ${n} ouverte : ${ETAPES_NOMS[n] || ''}.**${n === 3 ? ' Envoie tes 3 vidéos dans les 72 heures, et ne publie rien avant qu\'elles soient validées.' : ''}`,
        [{ label: n <= 3 ? `Ouvrir l'étape ${n}` : 'Mon parcours', url: lienPerso(p.discord_id, p.pseudo, n <= 3 ? `/parcours/etape-${n}` : '/parcours') }]));
    },
    async entreeReservee(p, seance) {
      await notifier.admin(`**${p.nom || p.pseudo || p.discord_id}** (<@${p.discord_id}>) a réservé son **coaching d'entrée** : ${seance.date} à ${seance.heure} GMT.`);
    },

    // ---- Étape 4 ----
    async compteRenduRecu(cr, p) {
      await notifier.admin(avecBoutons(`**${nomDe(p)}** (<@${cr.discord_id}>) a envoyé son **compte rendu du ${jourLisible(cr.jour)}**.`,
        [{ label: 'Ouvrir', url: lienCoach(`/admin/comptes-rendus/${cr.id}`) }]));
    },
    async compteRenduDecide(cr, p, decision) {
      if (decision === 'corriger') {
        await notifier.membre(cr.discord_id, avecBoutons(`**Ton coach demande des modifications sur ton compte rendu du ${jourLisible(cr.jour)}.** Lis sa remarque et renvoie-le.`,
          [{ label: 'Corriger mon compte rendu', url: lienPerso(cr.discord_id, p && p.pseudo, `/parcours/compte-rendu/${cr.jour}`) }]));
        return;
      }
      const st = suivi ? suivi.stats(cr.discord_id) : null;
      await notifier.membre(cr.discord_id, avecBoutons(`**Ton compte rendu du ${jourLisible(cr.jour)} est validé.**${st ? ` Récompenses validées au total : **${euros(st.revenusTotal)}**.` : ''}`,
        [{ label: 'Mon parcours', url: lienPerso(cr.discord_id, p && p.pseudo, '/parcours') }]));
    },
    // ---- Communauté : jamais le nom complet, seulement le prénom ou le pseudo (nom). ----
    // Nouveau résultat validé : ceux qui le suivent sont prévenus (l'argent d'abord, sinon les vues, sinon « a posté »).
    async resultatPartage(auteur, nouvelle, suiveurs) {
      const vues = (n) => (n >= 1e6 ? `${(Math.floor(n / 1e5) / 10)}M` : n >= 1e3 ? `${(Math.floor(n / 100) / 10)}K` : String(n));
      const quoi = nouvelle.type === 'gain' ? `vient de gagner **${euros(nouvelle.valeur)}**` : nouvelle.type === 'vues' ? `vient de faire **${vues(nouvelle.valeur)} vues**` : 'vient de poster un nouveau résultat';
      for (const f of suiveurs) {
        const qui = f.type === 'concurrent' ? `Ton concurrent **${auteur.nom}**` : `**${auteur.nom}**`;
        await notifier.membre(f.suiveur, avecBoutons(`${qui} ${quoi}. ${f.type === 'concurrent' ? 'À toi de jouer 🔥' : 'Et toi, ta vidéo du jour ?'}`,
          [{ label: 'Voir son profil', url: lienPerso(f.suiveur, pseudoParcours(f.suiveur), `/classement/${encodeURIComponent(auteur.id)}`) }]));
      }
    },
    async invitationConcurrence(c, de) {
      await notifier.membre(c.vers, avecBoutons(`**${de.nom}** te défie : le premier à **${euros(c.objectif)}** de récompenses gagne. Tu acceptes ?`,
        [{ label: 'Répondre', url: lienPerso(c.vers, pseudoParcours(c.vers), '/communaute') }]));
    },
    async reponseConcurrence(c, vers, oui) {
      await notifier.membre(c.de, avecBoutons(oui ? `**${vers.nom}** accepte ton défi : le premier à **${euros(c.objectif)}** gagne. C'est parti 🔥` : `**${vers.nom}** a refusé ton défi.`,
        [{ label: 'Ma communauté', url: lienPerso(c.de, pseudoParcours(c.de), '/communaute') }]));
    },
    async concurrenceGagnee(c, gagnant, perdant) {
      await notifier.membre(gagnant.id, `🏆 **Tu as gagné ta concurrence contre ${perdant.nom}** : tu as atteint **${euros(c.objectif)}** en premier !`);
      await notifier.membre(perdant.id, avecBoutons(`**${gagnant.nom}** a atteint **${euros(c.objectif)}** en premier et gagne votre concurrence. Lance un nouveau défi !`,
        [{ label: 'Ma communauté', url: lienPerso(perdant.id, pseudoParcours(perdant.id), '/communaute') }]));
    },
    // Seuil atteint (GOAT ou rôle de revenus) : le coach confirme, ici ou sur la plateforme.
    async recompensesAtteintes(p, roles) {
      for (const role of roles) {
        const quoi = role === 'goat' ? '**GOAT** ($1,000 sur 28 jours)' : `le rôle **${nomRole(role)}** (${ROLES_DISCORD[role].seuil} de récompenses validées)`;
        const boutons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recompense:${role}:${p.discord_id}`).setLabel(`Confirmer ${nomCourt(role)}`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setLabel('Voir sa fiche').setStyle(ButtonStyle.Link).setURL(lienCoach(`/admin/membres/${encodeURIComponent(p.discord_id)}`)));
        await notifier.admin({ content: `**${nomDe(p)}** (<@${p.discord_id}>) a atteint ${quoi} d'après ses comptes rendus validés. Confirme pour que je lui donne le rôle.`, components: [boutons] });
      }
    },
    async recompenseConfirmee(p, role) {
      const roleId = role === 'goat' ? config.discord.roleGoat : (config.discord.rolesRevenus || {})[role];
      try { await donnerRole(p.discord_id, roleId); } catch (err) { console.warn('[bob] rôle de récompense :', err.message); }
      const texte = role === 'goat'
        ? '**Tu es GOAT !** $1,000 en 28 jours : tu as atteint l\'objectif de l\'accompagnement. Ton rôle GOAT est ajouté : tu rejoins le live de groupe des GOAT.'
        : `**${ROLES_DISCORD[role].seuil} de récompenses au total : bravo !** Tu rejoins le **${nomRole(role)}** sur le serveur.`;
      await notifier.membre(p.discord_id, avecBoutons(texte, [{ label: 'Ma fiche', url: lienPerso(p.discord_id, p.pseudo, '/fiche') }]));
      log(`récompense ${role} donnée à ${p.discord_id}`);
    },

    // ---- Sinistres ----
    async ficheSinistre(p) {
      await notifier.admin(avecBoutons(`**${nomDe(p)}** (<@${p.discord_id}>) a rempli sa **fiche de sinistre**. Demande des précisions ou réhabilite-le.`,
        [{ label: 'Lire sa fiche', url: lienCoach(`/admin/membres/${encodeURIComponent(p.discord_id)}`) }]));
    },
    async sinistre(action, p, extra = {}) {
      if (action === 'ouvert') { await appliquerSinistre(p, extra, 'déclaré par ton coach'); return; }
      if (action === 'precisions') {
        await notifier.membre(p.discord_id, avecBoutons('**Ton coach demande des précisions sur ta fiche de sinistre.** Lis sa remarque et complète ta fiche.',
          [{ label: 'Compléter ma fiche', url: lienPerso(p.discord_id, p.pseudo, '/sinistre') }]));
        return;
      }
      if (action === 'rehabilite' || (action === 'retire' && extra.etaitSinistre)) await leverSinistre(p);
      const texte = action === 'rehabilite'
        ? '**Tu es réhabilité.** Ton accès au serveur et aux coachings est rétabli. Reprends ton parcours dès maintenant.'
        : `**Tes sinistres sont retirés (force majeure).** Compteur remis à 0, lives individuels rendus${extra.joursRendus ? `, et **${extra.joursRendus} jour(s)** ajoutés à tes 90 jours (fin le ${formatDate(p.fin_le)})` : ''}.`;
      await notifier.membre(p.discord_id, avecBoutons(texte, [{ label: 'Mon parcours', url: lienPerso(p.discord_id, p.pseudo, '/parcours') }]));
    },
  };
  const pseudoParcours = (id) => ((parcours && parcours.get(id)) || {}).pseudo || null;
  const nomDe = (p) => (p && (p.nom || p.pseudo)) || (p && p.discord_id) || '?';
  // Récompenses TikTok en dollars, écrites comme sur TikTok ($1,500 ; $48.70).
  const euros = (n) => { const x = Math.round(Number(n || 0) * 100) / 100; return `$${x.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 })}`; };

  // Sinistre : rôle Elite retiré (le rôle Sinistré ne voit que #sinistrés), créneaux de coaching libérés.
  async function appliquerSinistre(p, r, raison) {
    try {
      await donnerRole(p.discord_id, config.discord.roleSinistre);
      await retirerRole(p.discord_id, config.offres.elite.roleDiscord);
    } catch (err) { console.warn('[bob] rôles du sinistre :', err.message); }
    if (coaching) coaching.supprimerMembre(p.discord_id);
    const n = (r && r.numero) || p.sinistres;
    await notifier.membre(p.discord_id, avecBoutons(`**Tu es sinistré (${n} / 3)** : ${raison}.
`
      + 'Tu ne vois plus que le salon #sinistrés et tu n\'as plus de coaching. Remplis ta fiche de sinistre : ton coach décidera de ta réhabilitation.'
      + (r && r.total ? '\n**C\'est ton 3e sinistre : sinistré total.** Plus de live individuel, seulement les lives de groupe.' : ''),
      [{ label: 'Remplir ma fiche de sinistre', url: lienPerso(p.discord_id, p.pseudo, '/sinistre') }]));
    await notifier.admin(avecBoutons(`**${nomDe(p)}** (<@${p.discord_id}>) est **sinistré (${n} / 3)** : ${raison}.${r && r.total ? ' Sinistré total.' : ''} Ses créneaux de coaching sont libérés.`,
      [{ label: 'Voir sa fiche', url: lienCoach(`/admin/membres/${encodeURIComponent(p.discord_id)}`) }]));
    log(`sinistre ${n} pour ${p.discord_id} (${raison})`);
  }
  async function leverSinistre(p) {
    try {
      await donnerRole(p.discord_id, config.offres.elite.roleDiscord);
      await retirerRole(p.discord_id, config.discord.roleSinistre);
    } catch (err) { console.warn('[bob] rôles de la réhabilitation :', err.message); }
  }

  // ---------- Coaching : heures locales, disponibilités du coach, séances annulées ----------
  // Fuseau du membre : celui de son téléphone (page coaching), sinon celui de son étape 4.
  const fuseauDe = (id) => (coaching && (coaching.profil(id) || {}).fuseau) || (parcours && (parcours.get(id) || {}).fuseau) || null;
  const formater = (id, d, o) => { const f = fuseauDe(id); return d.toLocaleString('fr-FR', { timeZone: f || 'UTC', ...o }) + (f ? '' : ' GMT'); };
  const heureLocale = (id, d) => formater(id, d, { hour: '2-digit', minute: '2-digit' });
  const quandLocal = (id, d) => formater(id, d, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const jourHeureLocale = (id, d) => { const t = formater(id, d, { weekday: 'long', hour: '2-digit', minute: '2-digit' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const prevenirSeances = {
    // Séances annulées par une absence ou un imprévu du coach : chaque membre est prévenu, avec son coaching en réserve.
    async touchees(liste = []) {
      for (const t of liste) {
        const p = parcours && parcours.get(t.discordId);
        const quand = quandLocal(t.discordId, t.debut);
        const debut = t.touchee && t.touchee.type === 'imprevu'
          ? `**Imprévu de ton coach** : « ${t.touchee.message} »\nTa séance du **${quand}** n'aura pas lieu.`
          : `**Ton coach sera absent le ${quand}** : ta séance n'aura pas lieu.`;
        const reserve = t.credite ? 'Tu reçois **1 coaching en réserve** : reprogramme-le maintenant, ou garde-le pour plus tard.'
          : `Tu as déjà ${coaching.MAX_RESERVES} coachings en réserve (le maximum) : utilise-en un pour la remplacer.`;
        await notifier.membre(t.discordId, avecBoutons(`${debut}\nElle ne compte pas dans ton minimum de la semaine. ${reserve}`,
          [{ label: 'Reprogrammer ou garder', url: lienPerso(t.discordId, p && p.pseudo, '/coaching') }]));
      }
    },
    async retablies(liste = []) {
      for (const t of liste) {
        await notifier.membre(t.discordId, avecBoutons(`**Bonne nouvelle : ton coach sera finalement là le ${quandLocal(t.discordId, t.debut)}.** Ta séance est maintenue.`,
          [{ label: 'Mes coachings', url: lienPerso(t.discordId, null, '/coaching') }]));
      }
    },
    async semaineReservee(id, seances = []) {
      const lignes = seances.map((s) => `- ${jourHeureLocale(id, aHeure(s.date, s.heure))} (${s.date.split('-').reverse().slice(0, 2).join('/')})`).join('\n');
      await notifier.membre(id, avecBoutons(`Ta semaine de coaching est réservée (à ton heure) :\n${lignes}\nPense à réserver la suivante.`,
        [{ label: 'Mes coachings', url: lienPerso(id, null, '/coaching') }]));
    },
    async report(id, avant, apres, justification) {
      await notifier.admin(`**Séance reportée** : ${nomCoaching(id)} (<@${id}>), du ${avant.date} ${avant.heure} GMT au **${apres.date} ${apres.heure} GMT**.\nJustification : ${justification}`);
    },
    async reserveUtilisee(id, seance) {
      await notifier.admin(`**Coaching en réserve utilisé** : ${nomCoaching(id)} (<@${id}>), le **${seance.date} à ${seance.heure} GMT**.`);
    },
  };
  const nomCoaching = (id) => { const p = parcours && parcours.get(id); return (p && (p.nom || p.pseudo)) || ((coaching && coaching.profil(id)) || {}).pseudo || `<@${id}>`; };
  // Le dimanche matin (à partir de 8 h UTC), Bob demande au coach ses disponibilités de la semaine suivante.
  async function demanderDisponibilites() {
    if (!coaching || !config.discord.adminId) return;
    const now = maintenant();
    if (now.getUTCDay() !== 0 || now.getUTCHours() < 8) return;
    const lundi = ajouterJours(lundiDe(now), 7);
    const cle = `dispo:${lundi}`;
    if (dejaEnvoye(cle) || coaching.dispoEnvoyee(lundi)) return;
    if (await notifier.admin(avecBoutons(`**Tes disponibilités de la semaine du ${lundi.split('-').reverse().slice(0, 2).join('/')}.** Tout est coché par défaut : décoche seulement tes absences. `
      + 'Les membres concernés seront prévenus et recevront un coaching en réserve.',
    [{ label: 'Sélectionner mes disponibilités', url: lienCoach(`/admin/disponibilites?semaine=${lundi}`) }]))) marquer(cle);
  }

  // ---------- Photos de profil Discord (classement) ----------
  const qAvatar = db.prepare(`INSERT INTO profils_membres (discord_id, avatar, maj_le) VALUES (?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET avatar = excluded.avatar`);
  async function majAvatars() {
    if (!parcours || !client || !client.users) return;
    for (const p of parcours.tous()) {
      try {
        const u = await client.users.fetch(p.discord_id);
        const url = u && typeof u.displayAvatarURL === 'function' ? u.displayAvatarURL({ extension: 'png', size: 128 }) : null;
        if (url) qAvatar.run(p.discord_id, url, maintenant().toISOString());
      } catch { /* membre introuvable : on garde l'initiale */ }
    }
  }

  // ---------- Étape 4 : rappels quotidiens, à l'heure du membre ----------
  async function rappelsQuotidiens() {
    if (!parcours || !suivi) return;
    const now = maintenant();
    for (const p of parcours.tous()) {
      if (p.etape < 4 || p.sinistre_depuis || (p.fin_le && new Date(p.fin_le) < now)) continue;
      for (const r of suivi.rappelsDuMoment(p, now)) {
        const cle = `suivi:${p.discord_id}:${r.type}:${r.jour}`;
        if (dejaEnvoye(cle)) continue;
        marquer(cle);
        const lien = (chemin) => lienPerso(p.discord_id, p.pseudo, chemin);
        let contenu = null;
        if (r.type === 'creation') contenu = avecBoutons('**C\'est l\'heure de créer ta vidéo du jour.** Le montage prend 1 h maximum.', [{ label: 'Étape 4', url: lien('/parcours/etape-4') }]);
        if (r.type === 'publication' && !suivi.publications(p.discord_id, r.jour).length) {
          contenu = avecBoutons('**C\'est l\'heure de publier.** Une fois ta vidéo en ligne, déclare-la : son lien et la capture de ton compte.', [{ label: 'Déclarer ma vidéo', url: lien('/parcours/etape-4') }]);
        }
        if (r.type === 'compte-rendu') {
          // Les comptes rendus en retard ou à corriger, listés chaque jour à son heure de compte rendu.
          const aFaire = suivi.comptesRendusAFaire(p.discord_id);
          if (aFaire.length) {
            const corriger = aFaire.filter((x) => x.cr && x.cr.etat === 'corriger').length;
            contenu = avecBoutons(`**C'est l'heure de ton compte rendu.** ${aFaire.length === 1 ? `Celui du ${jourLisible(aFaire[0].jour)} est à ${corriger ? 'corriger' : 'envoyer'}.` : `${aFaire.length} sont à envoyer ou à corriger${corriger ? ` (dont ${corriger} à corriger)` : ''}.`}`,
              aFaire.slice(0, 10).map((x) => ({ label: `${x.cr && x.cr.etat === 'corriger' ? 'Corriger' : 'Compte rendu'} du ${jourLisible(x.jour)}`, url: lien(`/parcours/compte-rendu/${x.jour}`) })));
          }
        }
        if (contenu) { await notifier.membre(p.discord_id, contenu); log(`rappel ${r.type} envoyé à ${p.discord_id}`); }
      }
    }
  }

  // ---------- Absences et sinistres ----------
  // Absence = aucune interaction sur la plateforme (ni leçon terminée sur Whop) : 3 jours, 6 jours, puis sinistre à 7 jours.
  // Les jours où le membre attend son coach (exercices ou vidéos envoyés, coaching d'entrée fait) ne comptent pas.
  const ATTEND_LE_COACH = ['attente1', 'attente3'];
  async function surveillerAbsences() {
    if (!parcours || !sinistres) return;
    const now = maintenant();
    for (const p of parcours.tous()) {
      if (p.fin_le && new Date(p.fin_le) < now && !p.sinistre_depuis) continue; // 90 jours terminés
      const id = p.discord_id;
      const lien = (chemin) => lienPerso(id, p.pseudo, chemin);
      if (p.sinistre_depuis) {
        const s = sinistres.enCours(id);
        const plus = sinistres.ajouterSiToujoursAbsent(id);
        if (plus) {
          await notifier.membre(id, avecBoutons(`**Toujours absent : sinistre ${plus.numero} / 3.**${plus.total ? ' **Sinistré total** : plus de live individuel, seulement les lives de groupe.' : ''} Remplis ta fiche de sinistre.`,
            [{ label: 'Remplir ma fiche', url: lien('/sinistre') }]));
          await notifier.admin(`**${nomDe(p)}** (<@${id}>) toujours absent : **sinistre ${plus.numero} / 3**${plus.total ? ' (sinistré total)' : ''}.`);
        }
        // Fiche pas encore remplie (ou précisions demandées) : un rappel toutes les 24 h.
        if (s && ['ouvert', 'precisions'].includes(s.etat)) {
          const tranche = Math.floor((now - new Date(p.sinistre_depuis)) / JOUR_MS);
          const cle = `sinistre:${id}:${s.id}:${s.etat}:${tranche}`;
          if (tranche >= 1 && !dejaEnvoye(cle)) {
            marquer(cle);
            await notifier.membre(id, avecBoutons(s.etat === 'precisions' ? '**Rappel : ton coach attend les précisions sur ta fiche de sinistre.**' : '**Rappel : remplis ta fiche de sinistre.** Sans elle, ton coach ne peut pas te réhabiliter.',
              [{ label: 'Ma fiche de sinistre', url: lien('/sinistre') }]));
          }
        }
        continue;
      }
      const t = parcours.tache(id);
      const attendCoach = (t && ATTEND_LE_COACH.includes(t.cle)) || (p.etape === 2 && parcours.aTraiter().etape2.some((x) => x.parcours.discord_id === id));
      // Première surveillance (mise en service) ou attente du coach : le compteur repart de maintenant.
      if (!p.derniere_activite || attendCoach) { sinistres.noterActivite(id); continue; }
      const derniere = sinistres.derniereActivite(p).toISOString();
      const jours = sinistres.joursAbsent(p);
      if (jours >= sinistres.SEUILS.sinistre) {
        const r = sinistres.ouvrir(id);
        if (!r.erreur) await appliquerSinistre(r.parcours, r, `${jours} jours sans passer sur la plateforme`);
        continue;
      }
      const palier = jours >= sinistres.SEUILS.avertissement ? 'avertissement' : jours >= sinistres.SEUILS.message ? 'message' : null;
      const cle = palier && `absence:${id}:${derniere}:${palier}`;
      if (!cle || dejaEnvoye(cle)) continue;
      marquer(cle);
      const texte = palier === 'message'
        ? `**Pourquoi tu n'es pas là ?** Ça fait ${jours} jours que tu n'es pas passé sur la plateforme.${t ? ` Ta tâche du moment : ${t.titre.charAt(0).toLowerCase()}${t.titre.slice(1)}.` : ''}`
        : `**Demain, tu seras sinistré.** ${jours} jours sans passer sur la plateforme. Si tu ne reviens pas d'ici demain, tu perds l'accès au serveur et aux coachings.`;
      await notifier.membre(id, avecBoutons(texte, [{ label: t ? t.bouton : 'Mon parcours', url: lien(t ? t.lien : '/parcours') }]));
      log(`absence (${palier}, ${jours} j) : ${id}`);
    }
  }

  // Rappels des délais : à la moitié du délai, 1 h avant la fin, puis toutes les 12 h en retard.
  // Étape 3 sans planning de coaching : un rappel toutes les 12 h.
  async function relancerParcours() {
    if (!parcours) return;
    const now = maintenant().getTime();
    for (const p of parcours.tous()) {
      if (p.etape > 4 || p.sinistre_depuis) continue;
      const t = parcours.tache(p.discord_id);
      if (p.etape === 4) {
        if (t && t.cle === 'heures') {
          const tranche = Math.floor((now - new Date(p.etape_depuis).getTime()) / (6 * 3600 * 1000));
          const cle = `parcours:${p.discord_id}:heures:${p.etape_depuis}:${tranche}`;
          if (tranche >= 1 && !dejaEnvoye(cle)) {
            marquer(cle);
            await notifier.membre(p.discord_id, avecBoutons(`**Choisis tes 3 heures** (création, publication, compte rendu) : tu avais 12 heures pour le faire${tranche >= 2 ? ', le délai est dépassé' : ''}.`,
              [{ label: 'Choisir mes heures', url: lienPerso(p.discord_id, p.pseudo, '/parcours/etape-4') }]));
          }
        }
      } else if (t && t.delai) {
        const fin = new Date(t.delai.fin).getTime();
        const debut = fin - t.delai.duree;
        let moment = null;
        if (now >= fin) moment = `retard-${Math.floor((now - fin) / (12 * 3600 * 1000))}`;
        else if (now >= fin - 3600 * 1000) moment = 'h-1';
        else if (now >= debut + t.delai.duree / 2) moment = 'moitie';
        const cle = moment && `parcours:${p.discord_id}:${t.cle}:${t.delai.fin}:${moment}`;
        if (cle && !dejaEnvoye(cle)) {
          marquer(cle);
          const reste = fin - now;
          const h = Math.max(1, Math.round(Math.abs(reste) / 3600000));
          const texte = reste > 0 ? `**Rappel : ${t.titre.charAt(0).toLowerCase()}${t.titre.slice(1)}.** Il te reste **${h} h**.`
            : `**En retard : ${t.titre.charAt(0).toLowerCase()}${t.titre.slice(1)}.** Le délai est dépassé de ${h} h : fais-le dès maintenant.`;
          await notifier.membre(p.discord_id, avecBoutons(texte, [{ label: t.bouton, url: lienPerso(p.discord_id, p.pseudo, t.lien) }]));
          log(`rappel de délai (${t.cle}, ${moment}) envoyé à ${p.discord_id}`);
        }
      }
      if (p.etape >= 3 && coaching && !coaching.aUnPlanning(p.discord_id)) {
        const depuis = now - new Date(p.etape_depuis).getTime();
        const tranche = Math.floor(depuis / (12 * 3600 * 1000));
        const cle = `parcours:${p.discord_id}:planning:${p.etape_depuis}:${tranche}`;
        if (tranche >= 1 && !dejaEnvoye(cle)) {
          marquer(cle);
          await notifier.membre(p.discord_id, avecBoutons(`**Tu n'as pas encore de planning de coaching.** Réserve de ${config.coaching.minParSemaine} à ${config.coaching.maxParSemaine || 7} coachings par semaine.`,
            [{ label: 'Réserver mes coachings', url: lienPerso(p.discord_id, p.pseudo, '/coaching') }]));
        }
      }
    }
  }

  // ---------- Paiement Elite par carte (Whop) ----------
  // Whop donne le rôle Elite au candidat validé qui paie par carte : sa candidature passe « intégration confirmée »
  // et son lien mobile money est désactivé (pas de double paiement).
  async function paiementCarteDetecte(m) {
    const roleElite = config.offres.elite.roleDiscord;
    if (!candidatures || !roleElite || !m.roles.cache.has(roleElite)) return false;
    const c = candidatures.parDiscord(m.id);
    if (!c || c.statut !== 'valide' || !c.invitation_token) return false;
    if (q.payeeParCarte.run(maintenant().toISOString(), 'carte-whop', c.invitation_token).changes !== 1) return false;
    log(`candidature ${c.id} : payée par carte (rôle Elite donné par Whop)`);
    if (parcours) parcours.assurer(m.id, { pseudo: c.pseudo });
    await notifier.membre(m.id, avecBoutons('**Paiement reçu : bienvenue dans l\'Elite !**\nTon parcours commence : étape 1, la prise en main.',
      [{ label: 'Commencer mon parcours', url: lienMagique(config, { id: m.id, pseudo: c.pseudo }, '/parcours') }]));
    await notifier.admin(`**${c.pseudo}** (<@${m.id}>) a payé l'Elite **par carte** sur Whop : intégration confirmée.`);
    return true;
  }

  // ---------- Arrivée sur le serveur ----------
  // Message privé à chaque nouveau venu qui reçoit le rôle En Attente (à son arrivée, ou dès que le rôle lui est donné).
  // Une seule fois par arrivée : s'il quitte le serveur et revient, il le reçoit de nouveau.
  async function accueillir(m) {
    const role = config.discord.roleAttente;
    if (!m || !role || !m.roles || !m.roles.cache.has(role)) return false;
    if ((m.guild && m.guild.id !== config.discord.serveurId) || m.user?.bot || m.id === config.discord.adminId || m.pending) return false;
    const aUnAcces = Object.values(config.offres).some((o) => o.roleDiscord && m.roles.cache.has(o.roleDiscord))
      || (config.discord.roleGoat && m.roles.cache.has(config.discord.roleGoat));
    if (aUnAcces) return false;
    // Membre Community dans sa période d'attente : il a déjà reçu son message de renouvellement.
    if (q.enPeriodeAttente.get(m.id, maintenant().toISOString())) return false;
    const cle = `bienvenue-attente:${m.id}:${m.joinedTimestamp || 0}`;
    if (dejaEnvoye(cle)) return false;
    marquer(cle);
    const c = candidatures && candidatures.parDiscord(m.id);
    const contenu = c && STATUTS_CANDIDATURE_PROTEGES.includes(c.statut)
      ? avecBoutons('**Content de te revoir sur le serveur Overmaxx !**\nTa candidature Elite est toujours en cours : je t\'écris ici dès qu\'il y a du nouveau.',
        [{ label: 'Suivre ma candidature', url: lienMagique(config, { id: m.id, pseudo: c.pseudo }, `${config.offres.elite.base}/candidature`) }])
      : avecBoutons('**Bienvenue sur le serveur Overmaxx !**\nJe suis Bob, l\'assistant d\'Overmaxx. '
        + 'Pour l\'instant, tu ne vois que le salon d\'attente.\n'
        + 'Pour accéder au reste du serveur, rejoins l\'un des deux programmes :',
        [{ label: 'Rejoindre la Community', url: lienPerso(m.id, m.user?.username, '/community') },
          { label: 'Postuler à l\'Elite', url: lienPerso(m.id, m.user?.username, config.offres.elite.base) }]);
    const ok = await notifier.membre(m.id, contenu);
    log(ok ? `message de bienvenue envoyé à ${m.id}` : `message de bienvenue impossible pour ${m.id} (voir l'erreur ci-dessus)`);
    return ok;
  }

  // ---------- Rôle En Attente temporaire ----------
  // Un nouveau venu « En Attente » qui n'a rejoint aucun programme est retiré du serveur après 24 h.
  // Exceptions : candidature Elite en cours, membre Community dans sa période d'attente, admin, bots.
  async function nettoyerAttente() {
    const role = config.discord.roleAttente;
    if (!serveur || !role) return;
    // 0 (par défaut) : les nouveaux venus restent en attente sans limite ; on ne fait que retirer En Attente aux membres d'un programme.
    const delai = (config.discord.attenteNouveauxHeures || 0) * 3600 * 1000;
    const now = maintenant();
    let tous;
    try { tous = await serveur.members.fetch(); } catch (err) { console.warn('[bob] liste des membres :', err.message); return; }
    for (const m of tous.values()) {
      if (!m.roles.cache.has(role) || m.user?.bot || m.id === config.discord.adminId) continue;
      const aUnAcces = Object.values(config.offres).some((o) => o.roleDiscord && m.roles.cache.has(o.roleDiscord))
        || (config.discord.roleGoat && m.roles.cache.has(config.discord.roleGoat));
      if (aUnAcces) {
        try { await paiementCarteDetecte(m); } catch (err) { console.warn('[bob] paiement par carte :', err.message); }
        // Il a payé un programme (par exemple par carte sur Whop) : il n'est plus en attente.
        try { await m.roles.remove(role, 'Overmaxx : membre d\'un programme'); log(`rôle En Attente retiré à ${m.id} (membre d'un programme)`); } catch (err) { console.warn('[bob] retrait En Attente :', err.message); }
        continue;
      }
      if (!delai) continue;
      if (q.enPeriodeAttente.get(m.id, now.toISOString())) continue;
      const c = candidatures && candidatures.parDiscord(m.id);
      if (c && STATUTS_CANDIDATURE_PROTEGES.includes(c.statut)) continue;
      const note = q.attenteDepuis.get(`attente-depuis:${m.id}`);
      const depuis = Math.max(m.joinedTimestamp || 0, note ? new Date(note.envoye_le).getTime() : 0);
      if (!depuis || now.getTime() - depuis < delai) continue;
      await notifier.membre(m.id, avecBoutons('Tu étais **en attente** sur le serveur Overmaxx sans rejoindre de programme : ton accès est retiré. '
        + 'Tu peux revenir à tout moment.', [{ label: 'Revenir sur le serveur', url: config.lienDiscord }, { label: 'Rejoindre la Community', url: `${config.baseUrl}/community` }]));
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
      await rappelsQuotidiens();
      await notificationsDifferees();
      if (tour % 10 === 0) { await suivreCarte(); await nettoyerAttente(); await relancerCandidats(); await relancerWhop(); await relancerParcours(); await surveillerAbsences(); await demanderDisponibilites(); await majAvatars(); }
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
    relancerCandidats,
    configurerAttente,
    bloquerPourAttente,
    accueillir,
    paiementCarteDetecte,
    roleRecu,
    surRoleAjoute,
    prevenirAcces,
    accesDecide,
    acces,
    relancerWhop,
    suivreCarte,
    relancerParcours,
    rappelsQuotidiens,
    surveillerAbsences,
    demanderDisponibilites,
    notificationsDifferees,
    majAvatars,
    versPush,
    configurerSinistres,
    parcours: prevenirParcours,

    async demarrer() {
      if (!actif) { log('désactivé : DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID manquant.'); return; }
      client.on('interactionCreate', (i) => surInteraction(i).catch((e) => console.error('[bob] interaction :', e)));
      // Nouveau venu : message privé de bienvenue dès qu'il a le rôle En Attente.
      client.on('guildMemberAdd', (m) => accueillir(m).catch((e) => console.warn('[bob] arrivée :', e.message)));
      client.on('guildMemberUpdate', (avant, apres) => {
        const role = config.discord.roleAttente;
        const roleAjoute = role && apres.roles.cache.has(role) && (avant.partial || !avant.roles.cache.has(role));
        if (roleAjoute || (avant.pending && !apres.pending)) accueillir(apres).catch((e) => console.warn('[bob] arrivée :', e.message));
        surRoleAjoute(avant, apres).catch((e) => console.warn('[bob] rôle donné :', e.message));
      });
      client.on('channelCreate', (c) => {
        if (!c.guild || c.guild.id !== config.discord.serveurId) return;
        if (salonAttenteId()) bloquerPourAttente(c).catch((e) => console.warn('[bob] nouveau salon :', e.message));
        if (salonSinistresId()) bloquerPourSinistres(c).catch((e) => console.warn('[bob] nouveau salon (sinistrés) :', e.message));
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
              try {
                const moi = await moiSurLeServeur();
                if (moi && r.salon.permissionsFor && !r.salon.permissionsFor(moi)?.has(DROITS_FIL)) {
                  await notifier.admin('Quand un membre a fermé ses messages privés, je lui écris dans un **fil privé**. '
                    + 'Pour ça, donne à mon rôle **Créer des fils privés** et **Envoyer des messages dans les fils** '
                    + '(Paramètres du serveur > Rôles > Bob), puis relance le site.');
                }
              } catch (err) { console.warn('[bob] droits des fils privés :', err.message); }
              const nouveau = !dejaEnvoye(`config:bilan:${r.salon.id}`);
              if (nouveau || r.echecs.length) {
                marquer(`config:bilan:${r.salon.id}`);
                await notifier.admin(`Salon d'attente prêt : <#${r.salon.id}>. ${r.bloques} salon(s) ou catégorie(s) cachés au rôle En Attente.`
                  + (r.echecs.length ? `\nJe n'ai pas pu modifier : ${r.echecs.join(', ')}. Donne-moi l'accès à ces salons (ou « Gérer les salons »), puis relance le site.` : ''));
              }
            } else console.warn('[bob] salon d\'attente :', r.erreur);
          } catch (err) { console.error('[bob] salon d\'attente :', err.message); }
        }
        // Salon #sinistrés, configuré de la même façon.
        if (serveur && config.discord.roleSinistre && parcours) {
          try {
            const r = await configurerSinistres();
            if (r.ok) {
              const cle = `config:bilan-sinistres:${r.salon.id}`;
              if (!dejaEnvoye(cle) || r.echecs.length) {
                marquer(cle);
                await notifier.admin(`Salon des sinistrés prêt : <#${r.salon.id}>. ${r.bloques} salon(s) ou catégorie(s) cachés au rôle Sinistré.`
                  + (r.echecs.length ? `\nJe n'ai pas pu modifier : ${r.echecs.join(', ')}. Donne-moi l'accès à ces salons, puis relance le site.` : ''));
              }
            } else console.warn('[bob] salon des sinistrés :', r.erreur);
          } catch (err) { console.error('[bob] salon des sinistrés :', err.message); }
        }
        // Savoir qui donne les rôles (Whop ou toi) : Bob lit le journal d'audit du serveur.
        try {
          const moi = serveur ? await moiSurLeServeur() : null;
          if (moi && moi.permissions && !moi.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            await notifier.admin('Pour savoir si un rôle vient de **Whop** (paiement par carte) ou de **toi** (donné à la main), donne à mon rôle '
              + 'la permission **Voir les logs du serveur** (Paramètres du serveur > Rôles > Bob), puis relance le site.');
          }
        } catch (err) { console.warn('[bob] droit du journal d\'audit :', err.message); }
        cycle();
        setInterval(cycle, 60 * 1000).unref();
      });
      await client.login(config.discord.jetonBot);
    },

    // Paiement confirmé alors que la personne était connectée avec Discord : rôle tout de suite, En Attente retiré.
    async apresPaiement(membre, cmd) {
      if (!membre || !membre.discord_id || membre.statut !== 'actif') return;
      const o = config.offres[membre.programme];
      try {
        await donnerRole(membre.discord_id, o.roleDiscord);
        await retirerRole(membre.discord_id, config.discord.roleAttente);
      } catch (err) { console.warn('[bob] rôle après paiement :', err.message); }
      log(`paiement ${cmd && cmd.type} confirmé pour ${membre.discord_id} (${membre.programme}) : rôle donné`);
      if (cmd && cmd.type === 'renouvellement') {
        await notifier.membre(membre.discord_id, `**Renouvellement confirmé.** Ton accès à **${o.nom}** est valable jusqu'au **${formatDate(membre.acces_jusqu_au)}**.`);
      } else {
        const elite = membre.programme === 'elite';
        if (elite && parcours) {
          parcours.assurer(membre.discord_id, { pseudo: membre.discord_pseudo, nom: membre.nom, entree: membre.cree_le, fin: membre.acces_jusqu_au });
        }
        await notifier.membre(membre.discord_id, avecBoutons(`**Paiement confirmé : bienvenue dans ${o.nom} !** Ton rôle est ajouté sur le serveur.\n`
          + (elite ? `Ton accompagnement de 90 jours court jusqu'au **${formatDate(membre.acces_jusqu_au)}**. Débloque la formation sur Whop, puis commence ton parcours : étape 1, la prise en main.`
            : `Ton accès est valable jusqu'au **${formatDate(membre.acces_jusqu_au)}**. Il te reste à rejoindre la formation sur Whop.`),
          [...(cmd ? [{ label: 'Accéder à la formation', url: `${config.baseUrl}/acces/${cmd.ref}` }] : []),
            ...(elite && parcours ? [{ label: 'Commencer mon parcours', url: lienPerso(membre.discord_id, membre.discord_pseudo, '/parcours') }] : [])]));
      }
    },

    // Connexion depuis le site : la personne donne son pseudo, Bob lui envoie un bouton pour confirmer que c'est bien elle.
    // La connexion s'ouvre seulement dans le navigateur qui clique sur ce bouton.
    // Connexion au site : un code à 6 chiffres (à taper là où il l'a demandé, dans l'application aussi) et un bouton (navigateur).
    async envoyerConnexion(id, retour, saisie = '', { code } = {}) {
      const m = await membreDuServeur(id);
      const pseudo = (m && m.user && m.user.username) || String(saisie).trim().replace(/^@/, '');
      const texte = code
        ? `**Connexion à overmaxx.online**\nTon code : **${code}** (valable 10 minutes)\n`
          + 'Tape-le sur la page où tu l\'as demandé, même dans l\'application. Ou appuie sur le bouton pour continuer dans ton navigateur.\n'
          + '*Ce n\'est pas toi ? Ignore ce message et ne donne ce code à personne.*'
        : '**Connexion à overmaxx.online**\nTu viens de demander à te connecter au site. Clique sur le bouton pour continuer.\n'
          + '*Ce n\'est pas toi ? Ignore simplement ce message.*';
      // Le bouton d'une demande de connexion ne vaut que 15 minutes (les autres boutons de Bob, 30 jours).
      const r = await envoyer(id, avecBoutons(texte, [{ label: 'C\'est bien moi, continuer', url: lienMagique(config, { id, pseudo }, retour, code ? 15 : undefined) }]));
      return { id, pseudo, ok: r.ok, url: r.url };
    },

    // Après la connexion Discord d'un membre payé.
    async bienvenue(membre) {
      const o = config.offres[membre.programme];
      await notifier.membre(membre.discord_id, `Bienvenue dans **${o.nom}** ! Je suis **Bob**, le bot d'Overmaxx.\n`
        + `Ton accès est valable jusqu'au **${formatDate(membre.acces_jusqu_au)}**. Je te préviendrai avant la fin pour le renouveler.`);
    },

    async recapCoaching(discordId, reservations, decales) {
      // Chaque créneau fixe, à l'heure du membre (jour de la semaine et heure de sa prochaine séance).
      const prochaine = (r) => aHeure(r.effectif_le, r.heure);
      const lignes = reservations.map((r) => `- ${jourHeureLocale(discordId, prochaine(r))}`).join('\n');
      const d = decales.length
        ? `\n\nPas cette semaine (réservé trop tard, ou créneau indisponible ce jour-là) : ${decales.map((x) => `${x.effectifLe.split('-').reverse().slice(0, 2).join('/')} ${heureLocale(discordId, aHeure(x.effectifLe, x.heure))}`).join(', ')} est ta première séance.`
        : '';
      await notifier.membre(discordId, avecBoutons(`Tes créneaux de coaching fixes sont enregistrés (à ton heure) :\n${lignes}${d}`,
        [{ label: 'Mes coachings', url: lienPerso(discordId, null, '/coaching') }]));
    },

    async annulation(discordId, seance, justification) {
      const m = q.membresParDiscord.all(discordId).find((x) => x.programme === 'elite');
      await notifier.admin(`**Séance annulée** : ${(m && m.nom) || `<@${discordId}>`} (<@${discordId}>), le ${seance.date} à ${seance.heure} GMT.\nJustification : ${justification}`);
    },
    seances: prevenirSeances,

    appliquerDecision,
    candidatureRecue,
    idDepuisPseudo,
    videoRecue,

    async candidature(champs, note) {
      const lignes = champs.map((c) => `**${c.label}** : ${c.valeur}`).join('\n').slice(0, 1800);
      await notifier.admin(`**Nouvelle candidature Elite**${note ? `\n⚠️ ${note}` : ''}\n${lignes}\n\nSi tu retiens ce profil : contacte-le, puis tape \`/lien-elite\` pour lui créer son lien de paiement.`);
    },
  };
}

module.exports = { creerBob, formatPrix, PALIERS_JOURS };

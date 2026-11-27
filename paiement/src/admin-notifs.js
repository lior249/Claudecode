'use strict';

// Espace notifications du coach (admin) :
//  - le journal : chaque message que Bob t'envoie y est aussi rangé (lu / non lu), avec la page à ouvrir ;
//  - mes rappels : ceux que tu crées toi-même (une fois, chaque jour ou certains jours, à une heure GMT).
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCES = ['une-fois', 'jour', 'semaine'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Idées de rappels proposées en un clic.
const MODELES = [
  { texte: 'Vérifier les coachings du jour', frequence: 'jour', heure: '08:00', page: '/admin?vue=jour' },
  { texte: 'Donner mes disponibilités de la semaine', frequence: 'semaine', jours: [0], heure: '18:00', page: '/admin/disponibilites' },
  { texte: 'Préparer le prochain événement', frequence: 'semaine', jours: [3], heure: '10:00', page: '/admin/planifier' },
  { texte: 'Valider les comptes rendus en attente', frequence: 'jour', heure: '20:00', page: '/admin/a-traiter' },
];

// La page qu'ouvre un rappel : celle qu'il a choisie, sinon devinée d'après son texte.
const PAGES_RAPPEL = [
  ['/admin?vue=jour', 'Coachings du jour'], ['/admin/a-traiter', 'À traiter'], ['/admin/disponibilites', 'Mes disponibilités'],
  ['/admin/planifier', 'Planifier (événements, messages)'], ['/admin/eleves', 'Élèves Elite'], ['/coach', 'Mon profil'], ['/notifications?onglet=rappels', 'Mes rappels'],
];
function pageDevinee(texte) {
  const t = String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/coaching|seance/.test(t)) return '/admin?vue=jour';
  if (/disponibilit/.test(t)) return '/admin/disponibilites';
  if (/evenement|annonce|message a tous|planifi/.test(t)) return '/admin/planifier';
  if (/compte rendu|update|valider|resultat|traiter|video|candidature/.test(t)) return '/admin/a-traiter';
  if (/eleve|kanban/.test(t)) return '/admin/eleves';
  return '/admin/a-traiter';
}

// Texte lisible depuis un message Discord : sans les mentions ; le **gras** est gardé (titre en gras dans les listes).
function texteDe(contenu) {
  const brut = typeof contenu === 'string' ? contenu : (contenu && contenu.content) || '';
  return brut.replace(/__|`/g, '').replace(/\s*\(<@!?\d+>\)/g, '').replace(/<@!?\d+>/g, 'un membre').trim().slice(0, 1500);
}
// La page du site du premier bouton (lien personnel de Bob → seulement le chemin, jamais le jeton).
function lienDe(contenu) {
  const rangees = (contenu && contenu.components) || [];
  for (const r of rangees) {
    for (const b of r.components || []) {
      const url = b.data && b.data.url;
      if (!url) continue;
      try {
        const u = new URL(url);
        const retour = u.searchParams.get('retour');
        if (retour && /^\/(?![/\\])/.test(retour)) return retour.slice(0, 300);
        return /^https:\/\//.test(url) && !u.searchParams.get('t') ? url.slice(0, 300) : null;
      } catch { /* lien invalide */ }
    }
  }
  return null;
}

function creerNotifsAdmin({ db, maintenant = () => new Date() }) {
  const q = {
    ajouter: db.prepare('INSERT INTO notifications_admin (texte, lien, cree_le) VALUES (?, ?, ?)'),
    liste: db.prepare('SELECT * FROM notifications_admin ORDER BY id DESC LIMIT ?'),
    nonLues: db.prepare('SELECT COUNT(*) n FROM notifications_admin WHERE lu_le IS NULL'),
    toutLu: db.prepare('UPDATE notifications_admin SET lu_le = ? WHERE lu_le IS NULL'),
    luesRecentes: db.prepare('SELECT * FROM notifications_admin WHERE lu_le IS NOT NULL AND cree_le >= ? ORDER BY id DESC LIMIT ?'),
    nonLuesListe: db.prepare('SELECT * FROM notifications_admin WHERE lu_le IS NULL ORDER BY id DESC LIMIT ?'),
    une: db.prepare('SELECT * FROM notifications_admin WHERE id = ?'),
    lire: db.prepare('UPDATE notifications_admin SET lu_le = COALESCE(lu_le, ?) WHERE id = ?'),
    purger: db.prepare('DELETE FROM notifications_admin WHERE cree_le < ?'),
    rappels: db.prepare('SELECT * FROM rappels_admin ORDER BY actif DESC, heure, id'),
    rappel: db.prepare('SELECT * FROM rappels_admin WHERE id = ?'),
    creer: db.prepare('INSERT INTO rappels_admin (texte, frequence, jours, date, heure, actif, cree_le, page) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'),
    supprimer: db.prepare('DELETE FROM rappels_admin WHERE id = ?'),
    basculer: db.prepare('UPDATE rappels_admin SET actif = 1 - actif WHERE id = ?'),
    envoye: db.prepare('UPDATE rappels_admin SET dernier_envoi = ?, actif = CASE WHEN frequence = \'une-fois\' THEN 0 ELSE actif END WHERE id = ?'),
    actifs: db.prepare('SELECT * FROM rappels_admin WHERE actif = 1'),
    ajouterM: db.prepare('INSERT INTO notifications_membres (discord_id, texte, lien, cree_le) VALUES (?, ?, ?, ?)'),
    purgerM: db.prepare('DELETE FROM notifications_membres WHERE cree_le < ?'),
    listeM: db.prepare('SELECT * FROM notifications_membres WHERE discord_id = ? ORDER BY id DESC LIMIT ?'),
    nonLuesM: db.prepare('SELECT COUNT(*) n FROM notifications_membres WHERE discord_id = ? AND lu_le IS NULL'),
    toutLuM: db.prepare('UPDATE notifications_membres SET lu_le = ? WHERE lu_le IS NULL AND discord_id = ?'),
  };
  const iso = () => maintenant().toISOString();

  return {
    MODELES, JOURS, PAGES_RAPPEL,
    // La page à ouvrir quand le rappel arrive (le calendrier du jour : la date du jour).
    pageDuRappel(r) {
      const p = (r && r.page) || pageDevinee(r && r.texte);
      return p === '/admin?vue=jour' ? `/admin?vue=jour&date=${maintenant().toISOString().slice(0, 10)}` : p;
    },
    // Journal : chaque message de Bob au coach.
    noter(contenu) {
      const texte = texteDe(contenu);
      if (!texte) return;
      // Sans bouton : la notification ouvre la fiche du membre cité (<@id>), s'il y en a un.
      const brut = typeof contenu === 'string' ? contenu : (contenu && contenu.content) || '';
      const cite = brut.match(/<@!?(\d{5,25})>/);
      q.ajouter.run(texte, lienDe(contenu) || (cite ? `/admin/qui/${cite[1]}` : null), iso());
      q.purger.run(new Date(maintenant().getTime() - 90 * 86400000).toISOString()); // 90 jours gardés
    },
    liste(n = 100) { return q.liste.all(n); },
    nonLues() { return q.nonLues.get().n; },
    toutLu() { q.toutLu.run(iso()); },
    luesRecentes(n = 20) { return q.luesRecentes.all(new Date(maintenant().getTime() - 7 * 86400000).toISOString(), n); },
    nonLuesListe(n = 100) { return q.nonLuesListe.all(n); },
    // Le coach ouvre une page (depuis la notification du téléphone, À traiter ou ailleurs) : les notifications
    // non lues qui menaient à cette page passent en archive (lues). Renvoie leur nombre.
    lireParPage(chemin) {
      const p = String(chemin || '').split('#')[0].split('?')[0];
      if (!p || p === '/') return 0;
      let n = 0;
      for (const x of q.nonLuesListe.all(500)) {
        const l = String(x.lien || '').split('#')[0].split('?')[0];
        if (l && l === p) { q.lire.run(iso(), x.id); n++; }
      }
      return n;
    },
    // Archives : les notifications lues, les plus récentes d'abord.
    archives(n = 300) { return db.prepare('SELECT * FROM notifications_admin WHERE lu_le IS NOT NULL ORDER BY id DESC LIMIT ?').all(n); },
    // Ouvre une notification : marquée lue ; renvoie la page à ouvrir.
    lire(id) { const x = q.une.get(Number(id)); if (x) q.lire.run(iso(), x.id); return x || null; },

    // Les notifications de chaque membre (messages de Bob ou de l'application), pour sa cloche.
    noterMembre(discordId, contenu) {
      const texte = texteDe(contenu);
      if (!discordId || !texte) return;
      q.ajouterM.run(String(discordId), texte, lienDe(contenu), iso());
      q.purgerM.run(new Date(maintenant().getTime() - 60 * 86400000).toISOString());
    },
    listeMembre(discordId, n = 60) { return q.listeM.all(String(discordId), n); },
    nonLuesMembre(discordId) { return q.nonLuesM.get(String(discordId)).n; },
    toutLuMembre(discordId) { q.toutLuM.run(iso(), String(discordId)); },

    rappels() { return q.rappels.all().map((r) => ({ ...r, jours: r.jours ? r.jours.split(',').map(Number) : [] })); },
    creer({ texte, frequence, jours, date, heure, page }) {
      const t = String(texte || '').trim().slice(0, 300);
      if (!t) return { erreur: 'Écris ton rappel.' };
      if (!FREQUENCES.includes(frequence)) return { erreur: 'Choisis quand le rappel revient.' };
      if (!HEURE.test(String(heure || ''))) return { erreur: 'Choisis une heure.' };
      const liste = [].concat(jours || []).map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6);
      if (frequence === 'semaine' && !liste.length) return { erreur: 'Choisis au moins un jour de la semaine.' };
      if (frequence === 'une-fois' && !DATE.test(String(date || ''))) return { erreur: 'Choisis la date du rappel.' };
      const choisie = PAGES_RAPPEL.some(([p]) => p === page) ? page : null;
      q.creer.run(t, frequence, frequence === 'semaine' ? [...new Set(liste)].sort().join(',') : null, frequence === 'une-fois' ? date : null, heure, iso(), choisie);
      return { ok: true };
    },
    supprimer(id) { q.supprimer.run(Number(id)); },
    basculer(id) { q.basculer.run(Number(id)); },
    // Rappels à envoyer maintenant (heure GMT atteinte, pas encore envoyés pour cette occurrence, dans l'heure).
    dus(now = maintenant()) {
      const jour = now.toISOString().slice(0, 10);
      const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      return q.actifs.all().filter((r) => {
        const [h, m] = r.heure.split(':').map(Number);
        const a = h * 60 + m;
        if (minutes < a || minutes >= a + 60) return false;
        if (r.frequence === 'une-fois' && r.date !== jour) return false;
        if (r.frequence === 'semaine' && !String(r.jours || '').split(',').map(Number).includes(now.getUTCDay())) return false;
        return !r.dernier_envoi || r.dernier_envoi.slice(0, 10) !== jour;
      });
    },
    marquerEnvoye(id) { q.envoye.run(iso(), Number(id)); },
  };
}

// Rendu HTML d'un texte déjà échappé : **gras** → <b>, les ** orphelins (texte coupé) disparaissent.
const gras = (html) => String(html || '').replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>').replace(/\*\*/g, '');

module.exports = { gras, creerNotifsAdmin, texteDe, lienDe, MODELES, JOURS, PAGES_RAPPEL, pageDevinee };

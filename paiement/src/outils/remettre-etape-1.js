'use strict';

// Remet tous les élèves Elite à l'étape 1, comme s'ils venaient d'être acceptés : efface le suivi de l'accompagnement
// (exercices, vidéos, remarques, comptes rendus, rôles atteints, sinistres, suivis et concurrences, coachings réservés).
// Ne touche PAS aux comptes : paiements, membres, connexions, prénoms, accès validés, réglages des notifications.
//
//   node src/outils/remettre-etape-1.js               → montre ce qui serait effacé (rien n'est modifié)
//   node src/outils/remettre-etape-1.js --confirmer   → sauvegarde la base, puis efface
//   ajouter --garder-coaching pour garder les coachings réservés (créneaux fixes et séances)
const fs = require('fs');
const path = require('path');
const { ouvrirBase } = require('../db');

const confirmer = process.argv.includes('--confirmer');
const garderCoaching = process.argv.includes('--garder-coaching');
const fichier = process.env.FICHIER_BASE || './data/paiement.db';
if (!fs.existsSync(fichier)) { console.error(`Base introuvable : ${fichier}`); process.exit(1); }
const db = ouvrirBase(fichier);

const SUIVI = ['soumissions', 'remarques', 'publications', 'captures_jour', 'comptes_rendus', 'stats_videos', 'recompenses', 'sinistres', 'images_membres', 'suivis', 'concurrences'];
const COACHING = ['reservations', 'seances_ponctuelles', 'annulations', 'seances_touchees'];
const tables = [...SUIVI, ...(garderCoaching ? [] : COACHING)];
const compter = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
// Messages déjà envoyés par Bob pour le parcours : oubliés, pour que les rappels repartent de zéro.
const ENVOIS = "cle LIKE 'parcours:%' OR cle LIKE 'suivi:%' OR cle LIKE 'sinistre:%'" + (garderCoaching ? '' : " OR cle LIKE 'coach-perso:%'");

const eleves = db.prepare('SELECT COUNT(*) n FROM parcours').get().n;
const sinistres = db.prepare('SELECT COUNT(*) n FROM parcours WHERE sinistre_depuis IS NOT NULL OR sinistre_total = 1').get().n;
console.log(`Élèves Elite remis à l'étape 1 : ${eleves}`);
for (const t of tables) console.log(`  ${t} : ${compter(t)} ligne(s) effacée(s)`);
console.log(`  messages de Bob oubliés : ${db.prepare(`SELECT COUNT(*) n FROM envois WHERE ${ENVOIS}`).get().n}`);
if (garderCoaching) console.log('  coachings réservés : gardés');

if (!confirmer) {
  console.log('\nRien n\'a été modifié. Pour le faire vraiment, relance avec --confirmer.');
  process.exit(0);
}

// Sauvegarde complète avant d'effacer (à côté de la base).
const sauvegarde = path.join(path.dirname(path.resolve(fichier)), `sauvegarde-avant-etape-1-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
db.exec(`VACUUM INTO '${sauvegarde.replace(/'/g, "''")}'`);
console.log(`\nSauvegarde : ${sauvegarde}`);

const maintenant = new Date();
const fin = new Date(maintenant.getTime() + 90 * 86400000).toISOString();
db.exec('BEGIN');
try {
  for (const t of tables) db.exec(`DELETE FROM ${t}`);
  db.exec(`DELETE FROM envois WHERE ${ENVOIS}`);
  if (!garderCoaching) db.prepare('UPDATE profils_coaching SET reserves = 0').run();
  db.prepare(`UPDATE parcours SET etape = 1, etape_depuis = ?, niveau = NULL, compte_tiktok = NULL, niche = NULL, pays = NULL,
    entree_le = ?, fin_le = ?, etape1_le = NULL, etape2_le = NULL, etape3_le = NULL, heure_creation = NULL, heure_publication = NULL,
    heure_compte_rendu = NULL, derniere_activite = NULL, sinistres = 0, sinistre_depuis = NULL, sinistre_total = 0, etapes_forcees = NULL, maj_le = ?`)
    .run(maintenant.toISOString(), maintenant.toISOString(), fin, maintenant.toISOString());
  db.exec('COMMIT');
} catch (err) { db.exec('ROLLBACK'); console.error('Échec, rien n\'a été effacé :', err.message); process.exit(1); }

// Fichiers envoyés pendant les tests (vidéos d'exercices, images des remarques).
const dossier = path.join(path.dirname(path.resolve(fichier)), 'parcours');
let fichiers = 0;
for (const sous of ['videos', 'images']) {
  const d = path.join(dossier, sous);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) { fs.rmSync(path.join(d, f), { force: true, recursive: true }); fichiers++; }
}
console.log(`Fait : ${eleves} élève(s) à l'étape 1, ${fichiers} fichier(s) supprimé(s).`);
if (sinistres) console.log(`Attention : ${sinistres} élève(s) étaient sinistrés. Sur Discord, rends-leur le rôle Elite et retire le rôle Sinistré.`);
console.log('Les rôles GOAT et €1.5k / €5k / €10k Club donnés pendant les tests restent sur Discord : retire-les à la main si besoin.');

'use strict';

const { chargerConfig } = require('./config');
const { ouvrirBase, completerPrixGarantis } = require('./db');
const { creerClientSaspay } = require('./saspay');
const { creerClientWhop } = require('./whop');
const { creerEnvoyeurEmail } = require('./email');
const { creerCommandes } = require('./commandes');
const { creerCoaching } = require('./coaching');
const { creerSynchroWhop } = require('./synchro-whop');
const { creerDiscordOAuth } = require('./discord-oauth');
const { creerBob } = require('./bob');
const { creerCandidatures } = require('./candidatures');
const { creerParcours } = require('./parcours');
const { creerSuivi } = require('./suivi');
const { creerSinistres } = require('./sinistres');
const { creerPush } = require('./push');
const { creerAccesManuels } = require('./acces-manuels');
const { creerApp } = require('./app');

const config = chargerConfig();
const db = ouvrirBase(config.fichierBase);
completerPrixGarantis(db, config);

const saspay = creerClientSaspay(config.saspay);
const whop = creerClientWhop(config.whop);
// Paiement confirmé : Bob donne le rôle tout de suite (bob est créé juste après, d'où la fonction).
const commandes = creerCommandes({ db, saspay, whop, config, envoyerEmail: creerEnvoyeurEmail(config.email), surPaiement: (m, cmd) => bob.apresPaiement(m, cmd) });
const coaching = creerCoaching({ db, config });
const oauth = config.oauthActif ? creerDiscordOAuth(config) : null;
const candidatures = creerCandidatures({ db, config, commandes });
const parcours = creerParcours({ db, config });
const suivi = creerSuivi({ db, parcours });
parcours.suivi = suivi;
const sinistres = creerSinistres({ db, parcours });
const push = creerPush({ db, config });
const accesManuels = creerAccesManuels({ db, parcours, coaching });
const bob = creerBob({ config, db, commandes, coaching, candidatures, parcours, suivi, sinistres, push, accesManuels });
const synchro = creerSynchroWhop({ db, whop, config, notifier: bob.notifier });

const app = creerApp({ config, commandes, whop, coaching, oauth, bob, candidatures, parcours, suivi, sinistres, push, accesManuels });

const serveurHttp = app.listen(config.port, () => {
  console.log(`Serveur Overmaxx prêt sur le port ${config.port}`);
  console.log(`  SasPay : ${config.saspay.apiUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'} · Whop : ${config.whop.apiUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'}`);
  console.log(`  Bob : ${config.discordActif ? 'activé' : 'désactivé'} · Connexion Discord : ${config.oauthActif ? 'activée' : 'désactivée'}`);
});

// Envoi des vidéos de candidature depuis un téléphone : on laisse jusqu'à 30 minutes.
serveurHttp.requestTimeout = 30 * 60 * 1000;

// Liste d'attente Whop : toutes les minutes, même si Bob n'est pas configuré.
let synchroEnCours = false;
async function tourSynchro() {
  if (synchroEnCours) return;
  synchroEnCours = true;
  try { await synchro.executer(); } catch (err) { console.error('[whop] synchro :', err.message); } finally { synchroEnCours = false; }
}
setTimeout(tourSynchro, 5000);
setInterval(tourSynchro, 60 * 1000);

bob.demarrer().catch((err) => console.error('[bob] démarrage impossible :', err.message));

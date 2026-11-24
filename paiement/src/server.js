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
const { creerApp } = require('./app');

const config = chargerConfig();
const db = ouvrirBase(config.fichierBase);
completerPrixGarantis(db, config);

const saspay = creerClientSaspay(config.saspay);
const whop = creerClientWhop(config.whop);
const commandes = creerCommandes({ db, saspay, whop, config, envoyerEmail: creerEnvoyeurEmail(config.email) });
const coaching = creerCoaching({ db, config });
const oauth = config.oauthActif ? creerDiscordOAuth(config) : null;
const bob = creerBob({ config, db, commandes, coaching });
const synchro = creerSynchroWhop({ db, whop, config, notifier: bob.notifier });

const app = creerApp({ config, commandes, whop, coaching, oauth, bob });

app.listen(config.port, () => {
  console.log(`Serveur Overmaxx prêt sur le port ${config.port}`);
  console.log(`  SasPay : ${config.saspay.apiUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'} · Whop : ${config.whop.apiUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'}`);
  console.log(`  Bob : ${config.discordActif ? 'activé' : 'désactivé'} · Connexion Discord : ${config.oauthActif ? 'activée' : 'désactivée'}`);
});

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

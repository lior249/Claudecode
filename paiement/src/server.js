'use strict';

const { chargerConfig } = require('./config');
const { ouvrirBase } = require('./db');
const { creerClientSaspay } = require('./saspay');
const { creerClientWhop } = require('./whop');
const { creerEnvoyeurEmail } = require('./email');
const { creerCommandes } = require('./commandes');
const { creerApp } = require('./app');

const config = chargerConfig();
const db = ouvrirBase(config.fichierBase);
const saspay = creerClientSaspay(config.saspay);
const whop = creerClientWhop(config.whop);
const commandes = creerCommandes({ db, saspay, whop, config, envoyerEmail: creerEnvoyeurEmail(config.email) });
const app = creerApp({ config, commandes, whop });

app.listen(config.port, () => {
  const sandbox = config.saspay.apiUrl.includes('sandbox') && config.whop.apiUrl.includes('sandbox');
  console.log(`Serveur de paiement prêt sur le port ${config.port} (${sandbox ? 'SANDBOX' : 'PRODUCTION / mixte'})`);
});

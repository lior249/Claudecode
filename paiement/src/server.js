'use strict';

const { chargerConfig } = require('./config');
const { creerClientSaspay } = require('./saspay');
const { creerClientWhop } = require('./whop');
const { creerEnvoyeurEmail } = require('./email');
const { creerApp } = require('./app');

const config = chargerConfig();
const app = creerApp({
  config,
  saspay: creerClientSaspay(config.saspay),
  whop: creerClientWhop(config.whop),
  envoyerEmail: creerEnvoyeurEmail(config.email),
});

app.listen(config.port, () => {
  const sandbox = config.saspay.apiUrl.includes('sandbox') && config.whop.apiUrl.includes('sandbox');
  console.log(`Serveur de paiement prêt sur le port ${config.port} (${sandbox ? 'SANDBOX' : 'PRODUCTION / mixte'})`);
});

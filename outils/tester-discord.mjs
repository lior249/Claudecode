// Envoie un message privé de test sur Discord avec les réglages du site.
// Sur le serveur : docker exec creato-site node /app/outils/tester-discord.mjs
import { chargerEnv } from "../serveur.mjs";
import { discordConfigure, envoyerDiscord } from "../lib/discord.mjs";

chargerEnv(process.env.SITE_ENV ?? "/run/site.env");
if (!discordConfigure()) {
  console.log("❌ DISCORD_BOT_TOKEN ou DISCORD_USER_ID est vide dans site.env.");
  process.exit(1);
}
try {
  await envoyerDiscord("**Test Creato** : les messages de vente arriveront ici.");
  console.log("✅ Message envoyé : regarde tes messages privés Discord.");
} catch (e) {
  console.log(`❌ Échec : ${e.message}`);
  if (/401/.test(e.message)) console.log("   Le jeton du bot (DISCORD_BOT_TOKEN) est faux ou a été changé.");
  if (/400|404/.test(e.message)) console.log("   L'identifiant (DISCORD_USER_ID) est faux.");
  if (/fetch failed/.test(e.message)) console.log("   Le serveur n'arrive pas à joindre Discord : réessaie dans un instant.");
  if (/403/.test(e.message)) console.log("   Discord refuse le message privé : vérifie que le bot est sur ton serveur et que tes messages privés sont ouverts aux membres du serveur.");
  process.exit(1);
}

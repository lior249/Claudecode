# Creato — Learn

Projet repris depuis zéro.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet. Elles priment sur la spécification.

## Site Creato (Netlify)

- `site/` : la page publique (statique).
- `netlify/functions/` : réservation d'appels (`/api/creneaux`, `/api/reserver`), réservations gardées dans Netlify Blobs.
- `netlify/lib/agenda.mjs` : jours, heures et durée des appels.
- Prévenir sur Discord : variable `DISCORD_WEBHOOK_URL` (salon), ou `DISCORD_BOT_TOKEN` + `DISCORD_USER_ID` (message privé du bot).
- Tests : `npm test` (lancés aussi à chaque déploiement Netlify).

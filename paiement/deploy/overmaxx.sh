#!/usr/bin/env bash
# Met en ligne le site de paiement Overmaxx sur le serveur, en HTTPS, À CÔTÉ de creatoskills.site.
# Usage (dans /opt/overmaxx/paiement) : ./deploy/overmaxx.sh
# À relancer après chaque mise à jour (git pull) ou modification de overmaxx.env,
# ET après chaque ./deploy/site.sh de creatoskills.site (qui recrée le Caddy commun sans Overmaxx).
# Désactiver creatoskills.site : docker stop creato-site && docker update --restart=no creato-site, puis relancer ce script.
# Le réactiver : docker update --restart unless-stopped creato-site && docker start creato-site, puis relancer ce script.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="$ROOT/overmaxx.env"

valeur() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' | xargs; }

# ----- 1. Fichier de réglages -----
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  secret=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i "s/^APP_SECRET=.*/APP_SECRET=$secret/" "$ENV_FILE"
  sed -i "s#^BASE_URL=.*#BASE_URL=(rempli automatiquement depuis DOMAIN)#" "$ENV_FILE"
  echo "✅ Fichier de réglages créé : $ENV_FILE (APP_SECRET généré automatiquement)."
  echo "   Étape suivante : nano $ENV_FILE   (remplis DOMAIN, les clés SasPay et Whop…), puis relance ./deploy/overmaxx.sh"
  exit 0
fi

manque=0
for v in DOMAIN PRIX_INSCRIPTION PRIX_MENSUEL APP_SECRET SASPAY_API_KEY SASPAY_WEBHOOK_SECRET WHOP_API_KEY WHOP_COMPANY_ID WHOP_PLAN_ID; do
  if [ -z "$(valeur "$v")" ]; then echo "⚠️  $v est vide dans overmaxx.env"; manque=1; fi
done
[ "$manque" = 0 ] || { echo "Remplis ces réglages (nano $ENV_FILE), puis relance ./deploy/overmaxx.sh"; exit 1; }
DOMAIN=$(valeur DOMAIN)

# ----- 2. Application -----
echo "▶ Construction de l'application…"
docker build -q -t overmaxx-paiement "$ROOT" >/dev/null
docker network create creato-site >/dev/null 2>&1 || true
docker rm -f overmaxx-paiement >/dev/null 2>&1 || true
docker run -d --name overmaxx-paiement --restart unless-stopped --network creato-site \
  --env-file "$ENV_FILE" -e PORT=8080 -e FICHIER_BASE=/data/paiement.db -e BASE_URL="https://$DOMAIN" \
  -v overmaxx_data:/data \
  overmaxx-paiement >/dev/null

# ----- 3. HTTPS (Caddy) -----
# Le Caddy commun « creato-https » sert déjà creatoskills.site sur les ports 80/443.
# On le recrée avec un Caddyfile qui contient le bloc de creatoskills.site + celui d'Overmaxx.
BLOC="$DOMAIN {
	encode zstd gzip
	reverse_proxy overmaxx-paiement:8080
}"
# www.overmaxx.online → overmaxx.online (seulement si DOMAIN est un domaine nu, pas un sous-domaine).
if [ "$(echo "$DOMAIN" | tr -cd . | wc -c)" = 1 ]; then
  BLOC="$BLOC

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}"
fi
mkdir -p /opt/caddy-commun
# creatoskills.site n'est inclus que si son conteneur tourne (désactivé = docker stop creato-site).
if [ -f /opt/creato-site/deploy/Caddyfile.site ] && docker ps --format '{{.Names}}' | grep -qx creato-site; then
  SITE_DOMAIN=$(grep -E '^DOMAIN=' /opt/creato-site/site.env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)
  SITE_DOMAIN=${SITE_DOMAIN:-creatoskills.site}
  { cat /opt/creato-site/deploy/Caddyfile.site; echo; echo "# --- Overmaxx (ajouté par /opt/overmaxx/paiement/deploy/overmaxx.sh) ---"; echo "$BLOC"; } > /opt/caddy-commun/Caddyfile
else
  SITE_DOMAIN=""
  echo "ℹ️  creatoskills.site est désactivé : il n'est pas servi."
  echo "$BLOC" > /opt/caddy-commun/Caddyfile
fi
echo "▶ Mise à jour du HTTPS pour https://$DOMAIN …"
docker rm -f creato-https >/dev/null 2>&1 || true
docker run -d --name creato-https --restart unless-stopped --network creato-site \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -e DOMAIN="$SITE_DOMAIN" \
  -v /opt/caddy-commun/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v creato_caddy_data:/data \
  -v creato_caddy_config:/config \
  caddy:2-alpine >/dev/null

# ----- 4. Vérification -----
sleep 8
docker logs overmaxx-paiement 2>&1 | tail -3
if curl -fsS -o /dev/null "https://$DOMAIN/sante"; then
  echo "✅ Overmaxx est en ligne : https://$DOMAIN"
else
  echo "⏳ Le site démarre (le certificat HTTPS peut prendre une minute). Ouvre https://$DOMAIN un peu plus tard."
  echo "   En cas de souci : docker logs overmaxx-paiement --tail 30   et   docker logs creato-https --tail 30"
fi
[ -n "$SITE_DOMAIN" ] && { curl -fsS -o /dev/null "https://$SITE_DOMAIN/" && echo "✅ $SITE_DOMAIN fonctionne toujours." || echo "⚠️  Vérifie https://$SITE_DOMAIN"; }
echo "Webhook à déclarer dans SasPay : https://$DOMAIN/webhooks/saspay"

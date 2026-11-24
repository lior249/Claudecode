# Mettre Overmaxx en ligne sur ton serveur Namecheap

Ton serveur (VPS Namecheap, `203.161.61.189`) fait déjà tourner **creatoskills.site** avec Docker et Caddy.
Overmaxx s'installe **à côté**, dans `/opt/overmaxx`, sans toucher au site existant :

```
Internet ──► Caddy « creato-https » (ports 80/443, HTTPS automatique)
               ├── creatoskills.site  ──► conteneur creato-site       (inchangé)
               └── overmaxx.online    ──► conteneur overmaxx-paiement (nouveau)
```

On commence en **sandbox** (sans argent réel), puis on passe en production à la fin.

---

## Étape 1 : faire pointer overmaxx.online vers le serveur

Sur **namecheap.com** : Domain List → **Manage** à côté de `overmaxx.online` → onglet **Advanced DNS**.

1. Dans **Host Records**, **supprime** (icône poubelle) les enregistrements que Namecheap met par défaut :
   le *URL Redirect Record* sur `@` et le *CNAME Record* `www` → `parkingpage.namecheap.com`.
2. Ajoute ces deux enregistrements avec **Add new record** :

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `203.161.61.189` | Automatic |
| A Record | `www` | `203.161.61.189` | Automatic |

3. Clique sur la coche verte de chaque ligne pour enregistrer.

Le changement prend en général quelques minutes, parfois jusqu'à une heure. Pour vérifier depuis PowerShell :
```bash
nslookup overmaxx.online
```
La réponse doit afficher `203.161.61.189`. **Attends cette réponse avant l'étape 4** : sinon le certificat HTTPS
ne peut pas être créé.

`www.overmaxx.online` redirigera automatiquement vers `overmaxx.online`.

## Étape 2 : préparer Whop (sandbox : sandbox.whop.com)

1. Crée le produit Overmaxx, puis une **offre cachée en paiement unique** (par exemple 29 €), **sans abonnement** :
   c'est notre site qui gère les 5 € par mois. Elle ne sera débloquée qu'avec les codes -100 %.
2. Note l'identifiant de l'offre (`plan_...`), sa devise (`eur`) et l'identifiant de ton entreprise (`biz_...`).
3. Tableau de bord → **Développeur** : crée une clé API qui peut créer des codes promo et lire les offres.
4. Ajoute l'application **Discord** au produit, relie ton serveur Discord et choisis le rôle à donner.

## Étape 3 : préparer SasPay (mode Sandbox sur app.saspay.me)

1. **Développeur → Clés API** : crée une clé `sk_test_...` avec le scope **PAYIN**. Copie-la tout de suite.
2. **Développeur → Webhooks** : crée un webhook vers `https://overmaxx.online/webhooks/saspay`, abonné à
   **transaction.success**. **Copie le secret de signature tout de suite** : il ne s'affiche qu'une fois.

Le compte SasPay peut être le même que pour creatoskills.site : chaque site ignore les ventes de l'autre.

## Étape 4 : installer sur le serveur

1. Sur ton PC, ouvre **PowerShell** (clic droit sur Démarrer → Windows PowerShell), puis connecte-toi :
   ```bash
   ssh root@203.161.61.189
   ```
   Tape ton mot de passe, puis **Entrée** (rien ne s'affiche pendant la saisie, c'est normal).

2. Récupère le code, depuis le même dépôt GitHub que creatoskills.site :
   ```bash
   git clone --branch claude/epic-euler-veql49 "$(git -C /opt/creato-site remote get-url origin)" /opt/overmaxx
   ```

3. Crée le fichier de réglages :
   ```bash
   cd /opt/overmaxx/paiement && ./deploy/overmaxx.sh
   ```
   Le script crée `overmaxx.env` et génère tout seul la clé secrète `APP_SECRET` (ne la change jamais ensuite).

4. Remplis les réglages :
   ```bash
   nano /opt/overmaxx/paiement/overmaxx.env
   ```
   La souris ne marche pas dans cet éditeur : déplace-toi avec les flèches. À remplir au minimum :

   | Réglage | Quoi mettre |
   |---|---|
   | `DOMAIN` | déjà réglé sur `overmaxx.online` |
   | `PRIX_INSCRIPTION` / `PRIX_MENSUEL` | `19025` et `3280` (FCFA), ou tes montants |
   | `SASPAY_API_KEY` | la clé `sk_test_...` |
   | `SASPAY_WEBHOOK_SECRET` | le secret du webhook |
   | `WHOP_API_KEY`, `WHOP_COMPANY_ID`, `WHOP_PLAN_ID` | les valeurs de l'étape 2 |
   | `LIEN_DISCORD` | le lien d'invitation de ton Discord |
   | `WISTIA_MEDIA_ID` | l'identifiant de la vidéo du guide (facultatif) |
   | `CONTACT_SUPPORT` | ton contact, par exemple ton WhatsApp (facultatif) |

   Les adresses `SASPAY_API_URL` et `WHOP_API_URL` sont déjà réglées sur la sandbox.
   Pour enregistrer : **Ctrl+O**, **Entrée**, puis **Ctrl+X** pour quitter.

5. Mets en ligne :
   ```bash
   ./deploy/overmaxx.sh
   ```
   À la fin, tu dois voir « ✅ Overmaxx est en ligne » et « ✅ creatoskills.site fonctionne toujours ».

## Étape 5 : tester en sandbox

1. Ouvre **https://overmaxx.online** sur ton téléphone, clique sur **Payer par mobile money** et remplis le formulaire.
2. Sur la page SasPay, utilise un **numéro de test finissant par 0** : tu dois voir « Paiement confirmé », puis le guide avec le code.
3. Sur Whop (sandbox), utilise le code sur l'offre cachée : le prix doit passer à 0. Ensuite, connecte Discord.
4. Recommence avec un **numéro finissant par 1** : tu dois voir « Paiement non confirmé ».
5. Va sur `/renouveler` avec le même email et paie : la date de fin d'accès avance de 30 jours.

## Étape 6 : passer en production

Dans `overmaxx.env` (`nano` comme plus haut), change **tout en même temps** :

- `SASPAY_API_URL=https://api.saspay.me/api/v1` et la clé `sk_live_...` ;
- le secret d'un webhook créé en mode **production** sur SasPay ;
- `WHOP_API_URL=https://api.whop.com/api/v1`, avec la clé, `WHOP_COMPANY_ID` et `WHOP_PLAN_ID` de **whop.com** (et non de la sandbox).

Puis relance `./deploy/overmaxx.sh`.

---

## Au quotidien

**Mettre à jour après une modification du code :**
```bash
cd /opt/overmaxx && git pull && cd paiement && ./deploy/overmaxx.sh
```

**Important :** si tu relances `./deploy/site.sh` de creatoskills.site, relance ensuite `./deploy/overmaxx.sh`.
Le script de creatoskills.site recrée le Caddy commun sans Overmaxx.

**Voir ce qui se passe (erreurs, paiements) :**
```bash
docker logs overmaxx-paiement --tail 50
```

**Sauvegarder la base des membres** (dates d'abonnement) dans `/root` :
```bash
docker run --rm -v overmaxx_data:/data -v /root:/sauvegarde alpine sh -c 'cp /data/paiement.db* /sauvegarde/'
```

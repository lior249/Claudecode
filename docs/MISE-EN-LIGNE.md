# Mettre le site Creato en ligne sur creatoskills.site

Durée : environ 30 minutes. Fais les étapes **dans l'ordre**, sans en sauter.

> 🔒 Ne colle **jamais** une clé, un mot de passe ou un code d'accès dans une conversation.
> Ils vont uniquement dans le fichier `site.env` du serveur (étape 5).

---

## Étape 1 — Changer le prix dans Maketou (2 min)

1. Va sur <https://app.maketou.com> et connecte-toi.
2. Ouvre ta boutique, puis le produit **« Accès unique à la formation TikTok Vision »**.
3. Modifie le prix : **78 715** FCFA (= 120 €). Enregistre.
4. *(Conseillé)* Renomme le produit, par exemple « Accès à la formation Creato » : ce nom s'affiche sur la page de paiement.

## Étape 2 — Créer une nouvelle clé API Maketou (3 min)

L'ancienne clé a été envoyée dans une conversation : on la remplace.

1. Toujours dans ta boutique Maketou, clique sur **Autres**, puis sur **Clés API**.
2. Supprime la clé existante.
3. Clique sur **Ajouter une clé API**.
4. **Copie la clé** et colle-la dans un bloc-notes de ton ordinateur (elle ne s'affiche qu'une seule fois).
   Tu la colleras sur le serveur à l'étape 5, puis tu effaceras le bloc-notes.

## Étape 3 — Créer le webhook Discord (3 min, conseillé)

C'est l'adresse qui permet au site d'écrire dans un salon Discord à chaque paiement réussi.
Sans elle, le site marche quand même, mais tu ne seras pas prévenu.

1. Ouvre Discord **sur ordinateur** et va sur ton serveur.
2. Choisis le salon où tu veux recevoir les messages (de préférence un salon privé, par exemple `#paiements`).
3. Passe la souris sur le nom du salon et clique sur la **roue dentée** (« Modifier le salon »).
4. Clique sur **Intégrations**, puis sur **Webhooks**, puis sur **Nouveau webhook**.
5. Clique sur le webhook créé, donne-lui le nom `Creato`, puis clique sur **Copier l'URL du webhook**.
6. Colle cette adresse dans ton bloc-notes, sous la clé Maketou.

## Étape 4 — Choisir un nouveau code d'accès (2 min)

L'ancien code est visible publiquement sur GitHub. Choisis-en un nouveau (8 caractères ou plus, lettres et chiffres)
et note-le dans ton bloc-notes. Pense à le changer aussi là où il est vérifié pour rejoindre la communauté (sur Whop).

## Étape 5 — Installer le site sur le serveur (15 min)

### 5.1 Retrouver l'adresse du serveur

Sur <https://www.namecheap.com> : **Dashboard → Hosting List → ton VPS**. Note l'**adresse IP** (exemple : `198.54.12.34`).
Le mot de passe est celui que tu as choisi pour `root` lors de l'installation.

### 5.2 Ouvrir une fenêtre de commandes

- **Windows** : clic droit sur le bouton **Démarrer** → **Terminal** (ou **Windows PowerShell**).
- **Mac** : **Cmd + Espace** → tape `Terminal` → **Entrée**.

Astuce Windows : dans cette fenêtre, **clic droit = coller**.

### 5.3 Se connecter au serveur

Tape (avec ton adresse IP), puis **Entrée** :
```
ssh root@198.54.12.34
```
- Si la question `Are you sure you want to continue connecting?` apparaît : tape `yes`, puis **Entrée**.
- Tape le mot de passe, puis **Entrée**. **Rien ne s'affiche quand tu tapes, c'est normal.**
- ✅ C'est bon quand la ligne se termine par `root@…:~#`.

### 5.4 Télécharger le code du site

Copie cette ligne, colle-la (clic droit), puis **Entrée** :
```
git clone -b claude/laughing-wright-igl9h0 https://github.com/lior249/Claudecode.git /opt/creato-site
```
✅ Tu vois `Cloning into '/opt/creato-site'...` puis la ligne `root@…:~#` revient.

### 5.5 Créer le fichier de réglages

```
cd /opt/creato-site
```
puis :
```
./deploy/site.sh
```
✅ Tu vois :
```
Réglages repris de /opt/creato/landing.env (SasPay, code d'accès, lien de la communauté).
✅ Fichier de réglages créé : /opt/creato-site/site.env
   Ton site actuel n'a pas été touché.
```
À ce stade, ton site actuel est toujours en ligne, rien n'a changé.

### 5.6 Remplir les réglages

```
nano site.env
```
Le fichier s'ouvre. Tu te déplaces avec les **flèches du clavier** (la souris ne marche pas ici).

Remplis ces 3 lignes. Place le curseur **entre les deux guillemets**, puis colle (clic droit) :

| Ligne | Ce que tu mets entre les guillemets |
|-------|-------------------------------------|
| `DISCORD_WEBHOOK_URL=""` | l'adresse du webhook (étape 3) |
| `MAKETOU_API_KEY=""` | la nouvelle clé Maketou (étape 2) |
| `ACCESS_CODE="…"` | efface l'ancien code et écris le nouveau (étape 4) |

Exemple de ligne remplie : `MAKETOU_API_KEY="msk_xxxxxxxx…"`

Vérifie aussi que ces lignes ne sont **pas vides** (elles ont été reprises de l'ancienne page) :
`SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `COMMUNITY_URL`.
Si tu vois des lignes `DISCORD_BOT_TOKEN` ou `DISCORD_USER_ID`, laisse-les vides : elles ne servent plus.

Pour enregistrer et quitter :
1. **Ctrl + O**, puis **Entrée** (enregistre).
2. **Ctrl + X** (quitte).

Tu peux maintenant effacer ton bloc-notes.

### 5.7 Mettre le site en ligne

Récupère d'abord la dernière version du code :
```
git pull
```
Puis :
```
./deploy/site.sh
```
Attends environ 30 secondes. ✅ Tu dois voir :
```
▶ Démarrage du site sur https://creatoskills.site …
Site Creato sur le port 8080
  carte (Maketou) : actif
  mobile money (SasPay) : actif
  message Discord à chaque paiement : actif
{"ok":true,"carte":true,"mobileMoney":true,"discord":true}
✅ Le site est en ligne : https://creatoskills.site  (paiement : https://creatoskills.site/paiement/)
```
- Si une ligne commence par **⚠️** ou dit **fermé** : le réglage indiqué est vide → refais l'étape 5.6, puis 5.7.
- Si une ligne commence par **ℹ️** ou dit **non réglé** : c'est seulement le message Discord (étape 3), le site marche.
- Si tu vois **⏳** : attends une minute et ouvre le site. Si rien ne s'affiche, tape `docker logs creato-site --tail 30`
  et envoie-moi une capture d'écran (ces lignes ne contiennent aucun secret).

Pour te déconnecter du serveur : tape `exit`, puis **Entrée**.

---

## Étape 6 — Vérifier que tout marche (5 min, sur ton téléphone)

1. **Page principale** : ouvre <https://creatoskills.site>. Tu dois voir la nouvelle page (vidéo, résultats, FAQ…).
2. **Bouton sous la vidéo** : touche **Je veux rejoindre maintenant**. ✅ La page descend jusqu'au prix (120 €)
   et aux deux boutons de paiement.
3. **Paiement par carte** : touche **Payer par carte**, remplis prénom, nom, e-mail, puis **Continuer vers le paiement**.
   ✅ La page Maketou s'ouvre avec ton produit à 78 715 FCFA. Tu peux fermer sans payer.
4. **Paiement mobile money** : même chose avec **Payer par mobile money**. ✅ La page SasPay s'ouvre.
5. *(Conseillé)* Fais un vrai paiement : après le paiement, tu reviens sur la page « Paiement validé » avec le code,
   et un message « Nouveau paiement TikTok Elite » arrive sur Discord.

Rien à changer dans SasPay : l'adresse du webhook reste `https://creatoskills.site/api/saspay/webhook`.

---

## Plus tard

- **Mettre à jour le site** (quand je modifie quelque chose) : connecte-toi (étape 5.3), puis
  ```
  cd /opt/creato-site && git pull && ./deploy/site.sh
  ```
- **Modifier un réglage** : `cd /opt/creato-site && nano site.env`, puis `./deploy/site.sh`.
- **Voir les paiements réussis** : `docker exec creato-site grep -rl '"paid":true' /data/paiements/sessions`
- **Revenir à l'ancienne page** en cas de gros problème :
  ```
  docker rm -f creato-site creato-https && cd /opt/creato && ./deploy/landing.sh
  ```

## En cas d'erreur

| Message | Que faire |
|---------|-----------|
| `Connection timed out` (à l'étape 5.3) | L'adresse IP est fausse : vérifie-la dans Namecheap (5.1). |
| `Permission denied` (à l'étape 5.3) | Mot de passe faux : recommence la commande `ssh` et retape-le. |
| `already exists and is not an empty directory` (à l'étape 5.4) | Le code est déjà là : tape `cd /opt/creato-site && git pull` et passe à 5.5. |
| `git: command not found` | Tape `apt-get install -y git`, puis recommence 5.4. |
| `port is already allocated` (à l'étape 5.7) | Tape `docker ps` et envoie-moi une capture d'écran. |

# Mettre le site Creato en ligne sur creatoskills.site

Durée : environ 25 minutes. Fais les étapes **dans l'ordre**, sans en sauter.

> 🔒 Ne colle **jamais** une clé, un mot de passe ou un code d'accès dans une conversation.
> Ils vont uniquement dans le fichier `site.env` du serveur (étape 4.6).

---

## Étape 1 — Changer le prix dans Maketou (2 min)

1. Va sur <https://app.maketou.com> et connecte-toi.
2. Ouvre ta boutique, puis le produit **« Accès unique à la formation TikTok Vision »**.
3. Modifie le prix : **75 435** FCFA (= 115 €). Enregistre.
   Le site affiche 120 € : avec les frais de Maketou, le client paie environ 120 €.
4. *(Conseillé)* Renomme le produit, par exemple « Accès à la formation Creato » : ce nom s'affiche sur la page de paiement.

## Étape 2 — Créer une nouvelle clé API Maketou (3 min)

L'ancienne clé a été envoyée dans une conversation : on la remplace.

1. Toujours dans ta boutique Maketou, clique sur **Autres**, puis sur **Clés API**.
2. Supprime la clé existante.
3. Clique sur **Ajouter une clé API**.
4. **Copie la clé** et colle-la dans un bloc-notes de ton ordinateur (elle ne s'affiche qu'une seule fois).

## Étape 3 — Choisir un nouveau code d'accès (2 min)

L'ancien code est visible publiquement sur GitHub. Choisis-en un nouveau (8 caractères ou plus, lettres et chiffres)
et note-le dans ton bloc-notes. Pense à le changer aussi là où il est vérifié pour rejoindre la communauté (sur Whop).

## Étape 4 — Installer le site sur le serveur (15 min)

### 4.1 Retrouver l'adresse du serveur

Sur <https://www.namecheap.com> : **Dashboard → Hosting List → ton VPS**. Note l'**adresse IP** (exemple : `198.54.12.34`).
Le mot de passe est celui que tu as choisi pour `root` lors de l'installation.

### 4.2 Ouvrir une fenêtre de commandes

- **Windows** : clic droit sur le bouton **Démarrer** → **Terminal** (ou **Windows PowerShell**).
- **Mac** : **Cmd + Espace** → tape `Terminal` → **Entrée**.

Astuce Windows : dans cette fenêtre, **clic droit = coller**.

### 4.3 Se connecter au serveur

Tape (avec ton adresse IP), puis **Entrée** :
```
ssh root@198.54.12.34
```
- Si la question `Are you sure you want to continue connecting?` apparaît : tape `yes`, puis **Entrée**.
- Tape le mot de passe, puis **Entrée**. **Rien ne s'affiche quand tu tapes, c'est normal.**
- ✅ C'est bon quand la ligne se termine par `root@…:~#`.

### 4.4 Télécharger le code du site

Copie cette ligne, colle-la (clic droit), puis **Entrée** :
```
git clone -b claude/laughing-wright-igl9h0 https://github.com/lior249/Claudecode.git /opt/creato-site
```
✅ Tu vois `Cloning into '/opt/creato-site'...` puis la ligne `root@…:~#` revient.

### 4.5 Créer le fichier de réglages

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

### 4.6 Remplir les réglages

```
nano site.env
```
Le fichier s'ouvre. **La souris ne marche pas ici** : tu te déplaces avec les **flèches du clavier**.

**Ligne `MAKETOU_API_KEY=""`**
1. Descends avec ↓ jusqu'à cette ligne.
2. Appuie sur **Fin** (ou **End**) : le curseur va au bout de la ligne.
3. Appuie **une fois** sur ← : le curseur est entre les deux guillemets.
4. Colle la clé Maketou (étape 2) : **clic droit** (Windows) ou **Cmd + V** (Mac).
   La ligne ressemble à : `MAKETOU_API_KEY="msk_…"`

**Ligne `ACCESS_CODE="…"`** (elle contient l'ancien code)
1. Va sur la ligne, **Fin**, puis **une fois** ←.
2. **Retour arrière** (⌫) jusqu'à effacer l'ancien code, en gardant les deux guillemets : `ACCESS_CODE=""`.
3. Tape le nouveau code (étape 3).

**Ligne `SASPAY_AMOUNT`** : elle doit être exactement `SASPAY_AMOUNT="115.00"`.
Si elle contient `120.00`, remplace `120` par `115` (même méthode : **Fin**, ←, Retour arrière, puis tape).

**Ne touche pas aux autres lignes.** Si tu vois des lignes qui commencent par `DISCORD_`, laisse-les telles quelles :
elles ne servent plus.

Pour enregistrer et quitter :
1. **Ctrl + O**, puis **Entrée** (enregistre).
2. **Ctrl + X** (quitte).

Tu peux maintenant effacer ton bloc-notes.

### 4.7 Vérifier que c'est rempli (sans afficher les secrets)

```
grep -E '^[A-Z_]+=' site.env | sed -E 's/=""$/ : VIDE/; s/=.+$/ : rempli/'
```
✅ Tu dois voir **`rempli`** en face de `MAKETOU_API_KEY`, `ACCESS_CODE`, `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`
et `COMMUNITY_URL`. Si une de ces lignes est **`VIDE`**, refais 4.6 pour celle-là.

### 4.8 Mettre le site en ligne

Récupère la dernière version du code :
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
{"ok":true,"carte":true,"mobileMoney":true}
✅ Le site est en ligne : https://creatoskills.site  (paiement : https://creatoskills.site/paiement/)
```
- Si une ligne commence par **⚠️** ou dit **fermé** : le réglage indiqué est vide → refais 4.6, puis 4.8.
- Si tu vois **⏳** : attends une minute et ouvre le site. Si rien ne s'affiche, tape `docker logs creato-site --tail 30`
  et envoie-moi une capture d'écran (ces lignes ne contiennent aucun secret).

Pour te déconnecter du serveur : tape `exit`, puis **Entrée**.

---

## Étape 5 — Vérifier que tout marche (5 min, sur ton téléphone)

1. **Page principale** : ouvre <https://creatoskills.site>. Tu dois voir la nouvelle page (vidéo, résultats, FAQ…).
2. **Bouton sous la vidéo** : touche **Je veux rejoindre maintenant**. ✅ La page descend jusqu'au prix (120 €)
   et aux deux boutons de paiement.
3. **Paiement par carte** : touche **Payer par carte**, remplis prénom, nom, e-mail, puis **Continuer vers le paiement**.
   ✅ La page Maketou s'ouvre avec ton produit à 75 435 FCFA (plus les frais de Maketou). Tu peux fermer sans payer.
4. **Paiement mobile money** : même chose avec **Payer par mobile money**. ✅ La page SasPay s'ouvre.
5. *(Conseillé)* Fais un vrai paiement : après le paiement, tu reviens sur la page « Paiement validé » avec le code.

Rien à changer dans SasPay : l'adresse du webhook reste `https://creatoskills.site/api/saspay/webhook`.

---

## Plus tard

- **Mettre à jour le site** (quand je modifie quelque chose) : connecte-toi (étape 4.3), puis
  ```
  cd /opt/creato-site && git pull && ./deploy/site.sh
  ```
- **Modifier un réglage** : `cd /opt/creato-site && nano site.env`, puis `./deploy/site.sh`.
- **Voir les paiements** : dans tes tableaux de bord Maketou et SasPay, ou sur le serveur avec
  `docker logs creato-site | grep "Paiement réussi"`.
- **Revenir à l'ancienne page** en cas de gros problème :
  ```
  docker rm -f creato-site creato-https && cd /opt/creato && ./deploy/landing.sh
  ```

## En cas d'erreur

| Message | Que faire |
|---------|-----------|
| `Connection timed out` (à l'étape 4.3) | L'adresse IP est fausse : vérifie-la dans Namecheap (4.1). |
| `Permission denied` (à l'étape 4.3) | Mot de passe faux : recommence la commande `ssh` et retape-le. |
| `already exists and is not an empty directory` (à l'étape 4.4) | Le code est déjà là : tape `cd /opt/creato-site && git pull` et passe à 4.5. |
| `git: command not found` | Tape `apt-get install -y git`, puis recommence 4.4. |
| `port is already allocated` (à l'étape 4.8) | Tape `docker ps` et envoie-moi une capture d'écran. |

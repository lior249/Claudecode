# Landing page Creato

Site simple (HTML + CSS), indépendant de l'application Creato. Mise en page reprise de tunnel-vision-hq.whop.site
(fenêtres, galerie de résultats, offres, contact, FAQ), couleurs et logo Creato.

- `index.html` : présentation, résultats, offres, contact, FAQ ;
- `bienvenue.html` : la page d'accès après un paiement SasPay (compte Whop, compte Discord, lien d'accès) ;
- `config.js` : **les seuls réglages à modifier** (liens SasPay, Whop, accès, prix, vidéo YouTube, Discord, Instagram) ;
- `img/` : les images. Copie-y celles du dossier « TikTok Vision 1.0_files » de ta page enregistrée, avec les mêmes noms :
  `hero-creator-workspace.jpg`, `hero-vision-studio.jpg`, `hero-focus-mode.jpg`, `hero-money-mindset.jpg`,
  `hero-creator-energy.jpg`, `hero-workspace.jpg`, `result-01.jpg` à `result-20.jpg`, `contact-floh.jpg`.
  Une image absente laisse un cadre vide (en haut) ou disparaît (galerie).

Dans SasPay, l'adresse de retour après paiement doit être : `https://creatoskills.site/bienvenue.html`.

Limite actuelle : la page `bienvenue.html` est publique et le lien d'accès est le même pour tous.
Pour la protéger, il faudra vérifier le paiement auprès de SasPay (avec leur documentation).

# Landing page Creato

Site simple (HTML + CSS), indépendant de l'application Creato. Fichiers :
- `index.html` : la page de présentation et le paiement ;
- `bienvenue.html` : la page d'accès après le paiement (compte Whop, compte Discord, lien d'accès) ;
- `config.js` : **les seuls réglages à modifier** (lien SasPay, lien Whop, lien d'accès, prix, contact) ;
- `img/` : logo, mascotte, photos (remplace les cadres « Photo de résultat à ajouter » dans `index.html`).

Dans SasPay, l'adresse de retour après paiement doit être : `https://creatoskills.site/bienvenue.html`.

Limite actuelle : la page `bienvenue.html` est publique. Quelqu'un qui connaît son adresse peut la voir sans payer.
Pour la protéger, il faudra vérifier le paiement auprès de SasPay (étape suivante, avec leur documentation).

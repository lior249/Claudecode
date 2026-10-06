# Page TikTok Elite

- `index.html` : l'image, « Rejoins le TikTok Elite » et deux boutons (carte, mobile money) qui mènent tous les deux au paiement SasPay ;
- `merci.html` : retour de paiement (cercle qui devient vert, code à copier, bouton vers la communauté) ;
- `config.js` : les seuls réglages à modifier (lien SasPay, prix, code, lien de la communauté) ;
- `img/resultats/` : les captures de résultats (2 par ligne). Pour en ajouter : mets le fichier ici et ajoute son nom dans `results` de `config.js` ;
- `img/tiktok-elite.avif` (+ copie `.jpg` pour les vieux navigateurs).

Police Helvetica, lettres serrées (−100 ≈ −0,1 em) sur le titre ; fond noir, jaune Creato.
Dans SasPay, l'adresse de retour après paiement doit être : `https://creatoskills.site/merci.html`.

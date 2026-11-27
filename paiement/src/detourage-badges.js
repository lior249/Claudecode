'use strict';

// Badges de récompense d'un événement : détourage automatique dans le navigateur du coach, avant l'envoi.
//  - une planche (or, argent, bronze côte à côte, fond blanc) est découpée en 3 pièces, de gauche à droite ;
//  - ou une image par badge ;
//  - le fond blanc relié aux bords disparaît (le blanc des symboles, entouré par la pièce, est gardé), le bord est resserré
//    de 2 px (pas de liseré), la pièce est recadrée au carré et réduite à 320 px, puis envoyée en PNG transparent.

const BLOC_BADGES = (ICONE) => `<div class="champ badges-auto">
    <label>Badge de récompense (le fond blanc est retiré tout seul)</label>
    <label class="fichier">${ICONE.plus}<span><b>Envoyer la planche des 3 badges</b><br>Or, argent, bronze côte à côte, de gauche à droite, sur fond blanc</span><input type="file" accept="image/*" data-planche hidden></label>
    <div class="badges-slots">${[['or', 'Or (1er)'], ['argent', 'Argent (2e)'], ['bronze', 'Bronze (3e)']].map(([m, l]) => `<div class="badge-slot" data-metal="${m}">
      <div class="badge-apercu" data-apercu="${m}"><span class="doux petit">—</span></div><small>${l}</small>
      <label class="badge-changer">Une image<input type="file" accept="image/*" data-slot="${m}" hidden></label>
      <input type="hidden" name="badge_${m}" value=""></div>`).join('')}</div>
    <p class="doux petit" data-badges-etat style="margin:6px 0 0">Ou une image par badge. Aperçu sur fond sombre : vérifie qu'il ne reste pas de blanc autour.</p>
  </div>`;

const STYLE_BADGES = `<style>
  .badges-auto { min-width:0; }
  .badges-slots { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; margin-top:10px; }
  .badge-slot { display:grid; justify-items:center; gap:4px; padding:8px 4px; min-width:0; border-radius:14px; background:#0b0b0b; border:1px solid #242424; text-align:center; }
  .badge-apercu { width:68px; height:68px; display:grid; place-items:center; border-radius:12px; background:#1a1a1a; }
  .badge-apercu img { width:68px; height:68px; object-fit:contain; }
  .badge-changer { font-size:11.5px; font-weight:700; color:#fff; border:1px solid #333; border-radius:999px; padding:3px 8px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; margin:0; }
</style>`;

const SCRIPT_BADGES = `(function () {
  var zone = document.querySelector('.badges-auto'); if (!zone) return;
  var etat = zone.querySelector('[data-badges-etat]');
  function dire(t) { if (etat) etat.textContent = t; }
  function charger(fichier) {
    return new Promise(function (ok, ko) { var u = URL.createObjectURL(fichier); var im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); ok(im); }; im.onerror = function () { ko(new Error('Image illisible.')); }; im.src = u; });
  }
  // Détoure et découpe : renvoie une liste de canevas carrés 320 px (une pièce chacun).
  function detourer(im, nb) {
    var echelle = Math.min(1, 1600 / Math.max(im.width, im.height));
    var w = Math.round(im.width * echelle), h = Math.round(im.height * echelle);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    var img = x.getImageData(0, 0, w, h), d = img.data, n = w * h;
    var cand = new Uint8Array(n), fond = new Uint8Array(n);
    for (var i = 0; i < n; i++) { var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; var mn = Math.min(r, g, b), mx = Math.max(r, g, b); cand[i] = mn >= 247 && mx - mn <= 10 ? 1 : 0; }
    // Le fond : le blanc relié aux bords de l'image.
    var pile = new Int32Array(n), sp = 0;
    function pousser(p) { if (cand[p] && !fond[p]) { fond[p] = 1; pile[sp++] = p; } }
    for (var X = 0; X < w; X++) { pousser(X); pousser((h - 1) * w + X); }
    for (var Y = 0; Y < h; Y++) { pousser(Y * w); pousser(Y * w + w - 1); }
    while (sp) { var p = pile[--sp], px = p % w; if (px > 0) pousser(p - 1); if (px < w - 1) pousser(p + 1); if (p >= w) pousser(p - w); if (p < n - w) pousser(p + w); }
    // Bord resserré de 2 px : pas de liseré clair autour de la pièce.
    for (var k = 0; k < 2; k++) { var f2 = fond.slice(); for (var q = 0; q < n; q++) { if (fond[q]) continue; var qx = q % w;
      if ((qx > 0 && fond[q - 1]) || (qx < w - 1 && fond[q + 1]) || (q >= w && fond[q - w]) || (q < n - w && fond[q + w])) f2[q] = 1; } fond = f2; }
    for (var a = 0; a < n; a++) d[a * 4 + 3] = fond[a] ? 0 : 255;
    x.putImageData(img, 0, 0);
    // Découpe : les colonnes occupées (séparées par du vide), sinon des parts égales.
    var col = new Uint32Array(w); for (var z = 0; z < n; z++) if (!fond[z]) col[z % w]++;
    var segs = [], debut = -1, vide = 0;
    for (var cx = 0; cx < w; cx++) { if (col[cx]) { if (debut < 0) debut = cx; vide = 0; } else if (debut >= 0 && ++vide >= 6) { if (cx - vide - debut >= 40) segs.push([debut, cx - vide + 1]); debut = -1; vide = 0; } }
    if (debut >= 0) segs.push([debut, w]);
    if (segs.length !== nb) { segs = []; for (var s = 0; s < nb; s++) segs.push([Math.floor(s * w / nb), Math.floor((s + 1) * w / nb)]); }
    return segs.map(function (sg) {
      var y0 = h, y1 = 0, x0 = sg[1], x1 = sg[0];
      for (var yy = 0; yy < h; yy++) for (var xx = sg[0]; xx < sg[1]; xx++) if (!fond[yy * w + xx]) { if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
      if (y1 < y0) { y0 = 0; y1 = h - 1; x0 = sg[0]; x1 = sg[1] - 1; }
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1, cote = Math.max(bw, bh) + 16;
      var o = document.createElement('canvas'); o.width = 320; o.height = 320;
      var ox = o.getContext('2d'); var e = 320 / cote;
      ox.drawImage(c, x0, y0, bw, bh, (320 - bw * e) / 2, (320 - bh * e) / 2, bw * e, bh * e);
      return o;
    });
  }
  function envoyer(canevas, metal) {
    return new Promise(function (ok) { canevas.toBlob(function (blob) {
      fetch('/admin/images', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'image/png' }, body: blob })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!j.nom) { dire(j.erreur || 'Envoi refusé.'); return ok(false); }
          zone.querySelector('input[name="badge_' + metal + '"]').value = j.nom;
          var ap = zone.querySelector('[data-apercu="' + metal + '"]'); ap.innerHTML = ''; var i = document.createElement('img'); i.src = '/fichiers/images/' + j.nom; i.alt = ''; ap.appendChild(i);
          ok(true);
        }).catch(function () { dire('Envoi impossible : réessaie.'); ok(false); });
    }, 'image/png'); });
  }
  var METAUX = ['or', 'argent', 'bronze'];
  zone.querySelector('[data-planche]').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    dire('Détourage en cours…');
    charger(f).then(function (im) { var pieces = detourer(im, 3);
      return Promise.all(pieces.map(function (c, i) { return envoyer(c, METAUX[i]); })); })
      .then(function () { dire('Badges prêts : vérifie l\\'aperçu (or, argent, bronze). Tu peux remplacer un badge avec « Une image ».'); })
      .catch(function (e) { dire(e.message); });
  });
  zone.querySelectorAll('[data-slot]').forEach(function (inp) { inp.addEventListener('change', function () {
    var f = inp.files[0]; inp.value = ''; if (!f) return;
    dire('Détourage en cours…');
    charger(f).then(function (im) { return envoyer(detourer(im, 1)[0], inp.getAttribute('data-slot')); })
      .then(function () { dire('Badge prêt.'); }).catch(function (e) { dire(e.message); });
  }); });
})();`;

module.exports = { BLOC_BADGES, STYLE_BADGES, SCRIPT_BADGES };

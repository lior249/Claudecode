'use strict';

// Pages plus légères : les gros blocs <style> et <script> identiques d'une page à l'autre sortent du HTML et deviennent
// des fichiers /a/<empreinte>.css|js, gardés un an par le téléphone. Chaque page n'envoie plus que son contenu.
// L'empreinte vient du contenu : un style modifié a une nouvelle adresse, le téléphone le recharge tout seul.
const crypto = require('crypto');

const SEUIL = 1500;          // en dessous, le bloc reste dans la page (pas la peine d'une requête de plus)
const MAX = 2000;            // candidats gardés en mémoire (les plus anciens partent)

function creerAllegement() {
  // Un bloc ne sort de la page qu'une fois vu deux fois à l'identique : les blocs qui changent d'une page à l'autre
  // (données d'un élève) restent dans la page, et les fichiers servis ne disparaissent jamais.
  const blocs = new Map();  // empreinte → { type, contenu } (stables)
  const vus = new Map();    // empreinte → nombre de fois (candidats)
  const garder = (type, contenu) => {
    const h = crypto.createHash('sha1').update(contenu).digest('hex').slice(0, 16);
    if (blocs.has(h)) return h;
    const n = (vus.get(h) || 0) + 1;
    if (n < 2) {
      vus.set(h, n);
      if (vus.size > MAX) vus.delete(vus.keys().next().value);
      return null;
    }
    vus.delete(h);
    blocs.set(h, { type, contenu });
    return h;
  };
  function alleger(html) {
    if (typeof html !== 'string' || !html.startsWith('<!doctype html>')) return html;
    return html
      .replace(/<style>([\s\S]*?)<\/style>/g, (tout, css) => { const h = css.length >= SEUIL && garder('css', css); return h ? `<link rel="stylesheet" href="/a/${h}.css">` : tout; })
      // Seuls les scripts sans attribut (pas les speculationrules, JSON, modules…).
      .replace(/<script>([\s\S]*?)<\/script>/g, (tout, js) => { const h = js.length >= SEUIL && garder('js', js); return h ? `<script src="/a/${h}.js"></script>` : tout; });
  }
  // Middleware : res.send(html) envoie la page allégée ; /a/… sert les blocs.
  function middleware(req, res, next) {
    const m = /^\/a\/([0-9a-f]{16})\.(css|js)$/.exec(req.path);
    if (m) {
      const b = blocs.get(m[1]);
      if (!b || b.type !== m[2]) return res.status(404).end();
      res.set('Content-Type', b.type === 'css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(b.contenu);
    }
    const envoyer = res.send.bind(res);
    res.send = (corps) => envoyer(alleger(corps));
    return next();
  }
  return { middleware, alleger, blocs };
}

module.exports = { creerAllegement };

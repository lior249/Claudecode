'use strict';

// Liens TikTok : une vidéo s'identifie par son lien nettoyé (sans ?paramètres) ; le compte, par le lien de son profil.
function lienVideo(brut) {
  const l = String(brut || '').trim();
  if (!/^https:\/\/([a-z0-9-]+\.)*tiktok\.com\/\S+$/i.test(l) || l.length > 400) return null;
  try {
    const u = new URL(l);
    return `https://${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch { return null; }
}
// Compte : « @alias », « alias » ou un lien tiktok.com/@alias → https://www.tiktok.com/@alias ; un lien court TikTok est gardé.
function lienCompte(brut) {
  const v = String(brut || '').trim();
  if (!v) return null;
  const m = v.match(/tiktok\.com\/@([\w.-]{1,40})/i) || v.match(/^@?([\w.-]{2,40})$/);
  if (m) return `https://www.tiktok.com/@${m[1]}`;
  if (/^https:\/\/([a-z0-9-]+\.)*tiktok\.com\/\S+$/i.test(v) && v.length <= 200) return v;
  return undefined; // pas un compte TikTok
}
const aliasCompte = (lien) => { const m = String(lien || '').match(/@([\w.-]+)/); return m ? `@${m[1]}` : String(lien || ''); };

module.exports = { lienVideo, lienCompte, aliasCompte };

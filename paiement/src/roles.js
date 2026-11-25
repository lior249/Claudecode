'use strict';

// Les rôles du serveur Discord Overmaxx, avec leur nom et leur couleur (comme dans les paramètres du serveur),
// pour les pastilles du site (classement, profils, fiches) et les messages de Bob.
// Les seuils restent comptés en dollars, comme les récompenses TikTok ($1,500, $5,000, $10,000).
const ROLES = {
  10000: { nom: '€10k Club', club: true, couleur: '#f5c518', seuil: '$10,000' },
  5000: { nom: '€5k Club', club: true, couleur: '#c98a12', seuil: '$5,000' },
  1500: { nom: '€1.5k Club', club: true, couleur: '#ee8a2d', seuil: '$1,500' },
  goat: { nom: 'GOAT', couleur: '#f5c518', seuil: '$1,000 sur 28 jours' },
  sinistre: { nom: 'sinistré 😳', couleur: '#e5484d' },
  elite: { nom: 'Elite', couleur: '#4f46ff' },
  membre: { nom: 'Membre', couleur: '#a3e4a0' },
};
// Du plus élevé au moins élevé (rôles de résultats).
const ORDRE_ROLES = ['10000', '5000', '1500', 'goat'];

// Nom tel qu'il apparaît sur Discord (avec les couronnes des clubs).
const nomRole = (cle) => { const r = ROLES[cle]; return !r ? String(cle) : r.club ? `👑 ${r.nom} 👑` : r.nom; };
// Nom pour une phrase (sans les couronnes).
const nomCourt = (cle) => (ROLES[cle] ? ROLES[cle].nom : String(cle));

// Pastille façon Discord : fond sombre, point de la couleur du rôle, nom du rôle.
const STYLE_ROLES = `<style>
  .role-d { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 8px; border-radius:999px; background:#232428;
    border:1px solid color-mix(in srgb, var(--rc) 45%, #2e2f34); color:#f2f3f5; font-size:12.5px; font-weight:600; white-space:nowrap; }
  .role-d::before { content:''; width:10px; height:10px; border-radius:50%; background:var(--rc); flex:none; }
</style>`;
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function pastilleRole(cle) {
  const r = ROLES[cle];
  if (!r) return '';
  return `<span class="role-d" style="--rc:${r.couleur}">${echapper(nomRole(cle))}</span>`;
}

module.exports = { ROLES, ORDRE_ROLES, nomRole, nomCourt, pastilleRole, STYLE_ROLES };

'use strict';

function creerClientWhop({ apiUrl, cleApi, versionApi, idEntreprise }, fetchImpl = fetch) {
  async function appel(methode, chemin, corps) {
    const reponse = await fetchImpl(apiUrl + chemin, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cleApi}`,
        'Api-Version-Date': versionApi,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const texte = await reponse.text();
    let json = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
    if (!reponse.ok) {
      const err = new Error(`Whop ${methode} ${chemin} → HTTP ${reponse.status} : ${texte.slice(0, 300)}`);
      err.status = reponse.status;
      throw err;
    }
    return json;
  }

  const liens = new Map();

  return {
    // Lien public de l'offre (page Whop où le client demande à rejoindre la liste d'attente).
    async lienOffre(planId) {
      if (liens.has(planId)) return liens.get(planId);
      const offre = await appel('GET', `/plans/${encodeURIComponent(planId)}`);
      const lien = offre.purchase_url || `https://whop.com/checkout/${planId}`;
      liens.set(planId, lien);
      return lien;
    },

    // Demandes en attente sur la liste d'attente d'une offre (toutes les pages).
    async demandesEnAttente(planId) {
      const toutes = [];
      let apres = null;
      for (let i = 0; i < 20; i++) {
        const params = new URLSearchParams({ account_id: idEntreprise, variant_id: planId, status: 'pending', first: '100' });
        if (apres) params.set('after', apres);
        const res = await appel('GET', `/waitlist_entries?${params}`);
        toutes.push(...(res.data || []));
        if (!res.page_info || !res.page_info.has_next_page) break;
        apres = res.page_info.end_cursor;
      }
      return toutes;
    },

    demande(id) {
      return appel('GET', `/waitlist_entries/${encodeURIComponent(id)}`);
    },
    accepter(id) {
      return appel('POST', `/waitlist_entries/${encodeURIComponent(id)}/approve`);
    },
    refuser(id) {
      return appel('POST', `/waitlist_entries/${encodeURIComponent(id)}/deny`);
    },
    // Ajoute des jours gratuits à un accès Whop (renouvellement payé sur le site).
    prolonger(membershipId, jours) {
      return appel('POST', `/memberships/${encodeURIComponent(membershipId)}/extend`, { days: jours });
    },
  };
}

// L'email que le client a écrit en réponse à la question de la liste d'attente.
function emailDeLaDemande(demande) {
  for (const r of demande.custom_field_responses || []) {
    const m = String(r.answer || '').trim().toLowerCase().match(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/);
    if (m) return m[0];
  }
  return null;
}

module.exports = { creerClientWhop, emailDeLaDemande };

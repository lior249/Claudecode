'use strict';

function creerClientWhop({ apiUrl, cleApi, versionApi, idEntreprise, idOffre, deviseOffre, lienAchat }, fetchImpl = fetch) {
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
      signal: AbortSignal.timeout(10000),
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

  async function chercherCode(code) {
    let apres = null;
    for (let i = 0; i < 20; i++) {
      const params = new URLSearchParams({ account_id: idEntreprise, first: '100' });
      params.append('variant_ids', idOffre);
      if (apres) params.set('after', apres);
      const res = await appel('GET', `/promo_codes?${params}`);
      const trouve = (res.data || []).find((p) => p.code === code);
      if (trouve) return trouve;
      if (!res.page_info || !res.page_info.has_next_page) return null;
      apres = res.page_info.end_cursor;
    }
    return null;
  }

  let lienEnCache = lienAchat || null;

  return {
    // Crée un code -100 %, utilisable une seule fois, valable uniquement sur l'offre cachée.
    // Idempotent : si le code existe déjà (409), on renvoie l'existant.
    async assurerCodePromo(code) {
      try {
        const cree = await appel('POST', '/promo_codes', {
          account_id: idEntreprise,
          code,
          promo_type: 'percentage',
          amount_off: 100,
          base_currency: deviseOffre,
          new_users_only: false,
          one_per_customer: true,
          promo_duration_months: 1,
          stock: 1,
          unlimited_stock: false,
          variant_ids: [idOffre],
        });
        return { code: cree.code || code, id: cree.id, nouveau: true };
      } catch (err) {
        if (err.status !== 409) throw err;
        const existant = await chercherCode(code);
        if (!existant) throw new Error(`Whop : conflit sur le code ${code} mais introuvable dans la liste`);
        return { code: existant.code, id: existant.id, nouveau: false };
      }
    },

    async lienAchatOffre() {
      if (lienEnCache) return lienEnCache;
      const offre = await appel('GET', `/plans/${encodeURIComponent(idOffre)}`);
      if (!offre.purchase_url) throw new Error('Whop : purchase_url absent sur l\'offre');
      lienEnCache = offre.purchase_url;
      return lienEnCache;
    },
  };
}

module.exports = { creerClientWhop };

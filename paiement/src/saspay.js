'use strict';

const crypto = require('crypto');

const TOLERANCE_SECONDES = 300;

// Vérifie un webhook SasPay : âge (5 min max) + HMAC-SHA256 de "{timestamp}.{corps brut}".
function signatureValide(corpsBrut, signature, timestamp, secret, maintenant = Date.now()) {
  if (!signature || !timestamp || !/^\d+$/.test(String(timestamp))) return false;
  const ecart = Math.abs(Math.floor(maintenant / 1000) - Number(timestamp));
  if (ecart > TOLERANCE_SECONDES) return false;

  const attendu = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), Buffer.from(corpsBrut)]))
    .digest('hex');

  const a = Buffer.from(String(signature).toLowerCase());
  const b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function creerClientSaspay({ apiUrl, cleApi, pagesRecherche }, fetchImpl = fetch) {
  async function appel(methode, chemin, corps) {
    const reponse = await fetchImpl(apiUrl + chemin, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cleApi}`,
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
      const err = new Error(`SasPay ${methode} ${chemin} → HTTP ${reponse.status} : ${texte.slice(0, 300)}`);
      err.status = reponse.status;
      throw err;
    }
    // Certaines réponses sont enveloppées dans { success, data, code }.
    return json && typeof json === 'object' && 'data' in json && 'success' in json ? json.data : json;
  }

  return {
    creerSessionCheckout(donnees) {
      return appel('POST', '/checkout-sessions/', donnees);
    },
    statutSession(id) {
      return appel('GET', `/checkout-sessions/${encodeURIComponent(id)}/status/`);
    },
    detailSession(id) {
      return appel('GET', `/checkout-sessions/${encodeURIComponent(id)}/`);
    },
    verifierPaiement(idPaiement) {
      return appel('GET', `/payments/${encodeURIComponent(idPaiement)}/verify/`);
    },

    // Le webhook ne contient pas l'email du client : on retrouve la session de checkout
    // (créée par nous, avec l'email) à partir de l'identifiant de la transaction.
    async trouverSessionParTransaction(idTransaction) {
      for (const statut of ['PAID', null]) {
        for (let page = 1; page <= pagesRecherche; page++) {
          const params = new URLSearchParams({ page: String(page), page_size: '100' });
          if (statut) params.set('status', statut);
          const res = await appel('GET', `/checkout-sessions/?${params}`);
          const liste = Array.isArray(res) ? res : (res && res.results) || [];
          const trouvee = liste.find((s) => {
            const t = s.transaction;
            return t === idTransaction || (t && typeof t === 'object' && t.id === idTransaction);
          });
          if (trouvee) return trouvee;
          const suivante = !Array.isArray(res) && res && res.next;
          if (!suivante || liste.length === 0) break;
        }
      }
      return null;
    },
  };
}

module.exports = { signatureValide, creerClientSaspay };

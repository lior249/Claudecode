'use strict';

const crypto = require('crypto');
const { codePourRef, paiementConforme } = require('./acces');

const JOUR_MS = 24 * 3600 * 1000;

// Logique métier : commandes (inscription / renouvellement), vérification des paiements,
// création des accès. Idempotente : peut être appelée par le webhook ET par la page de
// confirmation, autant de fois que nécessaire.
function creerCommandes({ db, saspay, whop, config, envoyerEmail, maintenant = () => new Date() }) {
  const q = {
    insererCommande: db.prepare(`INSERT INTO commandes (ref, type, email, nom, telephone, montant, devise, cree_le)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    lierSession: db.prepare('UPDATE commandes SET saspay_session_id = ? WHERE ref = ?'),
    commande: db.prepare('SELECT * FROM commandes WHERE ref = ?'),
    commandeParSession: db.prepare('SELECT * FROM commandes WHERE saspay_session_id = ?'),
    marquerPayee: db.prepare(`UPDATE commandes SET statut = 'PAYEE', saspay_tx_id = ?, payee_le = ?
                              WHERE ref = ? AND statut = 'EN_ATTENTE'`),
    marquerEchec: db.prepare(`UPDATE commandes SET statut = 'ECHEC' WHERE ref = ? AND statut = 'EN_ATTENTE'`),
    enregistrerCode: db.prepare('UPDATE commandes SET code_promo = ? WHERE ref = ? AND code_promo IS NULL'),
    membre: db.prepare('SELECT * FROM membres WHERE email = ?'),
    insererMembre: db.prepare(`INSERT INTO membres (email, nom, telephone, acces_jusqu_au, cree_le, maj_le)
                               VALUES (?, ?, ?, ?, ?, ?)`),
    prolongerMembre: db.prepare('UPDATE membres SET acces_jusqu_au = ?, maj_le = ? WHERE email = ?'),
    codeMembre: db.prepare('UPDATE membres SET code_promo = ?, maj_le = ? WHERE email = ? AND code_promo IS NULL'),
  };

  function nouvelleFin(finActuelle) {
    const now = maintenant();
    const depart = finActuelle && new Date(finActuelle) > now ? new Date(finActuelle) : now;
    return new Date(depart.getTime() + config.dureeAccesJours * JOUR_MS).toISOString();
  }

  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  // Passe la commande en PAYEE et applique l'effet (accès créé ou prolongé) en une seule transaction.
  function finaliser(cmd, idTransaction) {
    transaction(() => {
      const iso = maintenant().toISOString();
      if (q.marquerPayee.run(idTransaction, iso, cmd.ref).changes !== 1) return; // déjà traitée
      const membre = q.membre.get(cmd.email);
      if (membre) {
        q.prolongerMembre.run(nouvelleFin(membre.acces_jusqu_au), iso, cmd.email);
      } else {
        q.insererMembre.run(cmd.email, cmd.nom, cmd.telephone, nouvelleFin(null), iso, iso);
      }
    });
  }

  // Pour une inscription payée : crée le code promo Whop (une seule fois) et envoie l'email.
  async function assurerCode(cmd) {
    if (cmd.type !== 'inscription' || cmd.code_promo) return cmd.code_promo || null;
    const promo = await whop.assurerCodePromo(codePourRef(cmd.ref, config.secretApp));
    const premier = q.enregistrerCode.run(promo.code, cmd.ref).changes === 1;
    q.codeMembre.run(promo.code, maintenant().toISOString(), cmd.email);
    if (premier && envoyerEmail) {
      try {
        await envoyerEmail({
          email: cmd.email, nom: cmd.nom, code: promo.code,
          lien: await whop.lienAchatOffre(), nomFormation: config.nomFormation,
        });
      } catch (err) { console.error('[email]', err.message); }
    }
    return promo.code;
  }

  return {
    prixPour(type) {
      return type === 'inscription' ? config.prixInscription : config.prixMensuel;
    },

    // Ce que le client a rempli, pour l'onglet « Détails » de la page de statut.
    details(ref) {
      const c = q.commande.get(ref);
      if (!c) return null;
      return {
        ref: c.ref, type: c.type, nom: c.nom, email: c.email, telephone: c.telephone,
        montant: c.montant, devise: c.devise, creeLe: c.cree_le, payeeLe: c.payee_le,
      };
    },

    membre(email) {
      return q.membre.get(String(email || '').trim().toLowerCase()) || null;
    },

    // Crée la commande en base puis la session de paiement SasPay. Renvoie l'URL de paiement.
    async demarrer({ type, email, nom, telephone }) {
      const ref = crypto.randomBytes(16).toString('base64url');
      const montant = Number(this.prixPour(type)).toFixed(2);
      q.insererCommande.run(ref, type, email, nom, telephone || null, montant, config.devise, maintenant().toISOString());

      const corps = {
        amount: montant,
        currency: config.devise,
        description: type === 'inscription'
          ? `${config.nomFormation} — inscription`
          : `${config.nomFormation} — abonnement mensuel`,
        customer_email: email,
        customer_name: nom,
        return_url: `${config.baseUrl}/confirmation/${ref}`,
        metadata: { ref, type },
      };
      if (telephone) corps.customer_phone = telephone;
      if (config.pays) corps.country = config.pays;

      const session = await saspay.creerSessionCheckout(corps);
      if (!session || !session.id || !session.checkout_url) throw new Error('Réponse SasPay inattendue');
      q.lierSession.run(session.id, ref);
      return { ref, urlPaiement: session.checkout_url };
    },

    // État d'une commande, en revérifiant auprès de SasPay si elle est encore en attente.
    // etat : 'en_attente' | 'confirme' | 'echec' | 'introuvable'
    async etat(ref) {
      let cmd = q.commande.get(ref);
      if (!cmd) return { etat: 'introuvable' };

      if (cmd.statut === 'EN_ATTENTE' && cmd.saspay_session_id) {
        const s = await saspay.statutSession(cmd.saspay_session_id);
        if (s.status === 'PAID' && s.transaction_status === 'SUCCESS' && s.transaction_id) {
          const verif = await paiementConforme(saspay, s.transaction_id, cmd);
          if (verif.ok) {
            finaliser(cmd, s.transaction_id);
          } else {
            console.warn(`[commande ${ref}] paiement non conforme : ${verif.raison}`);
            q.marquerEchec.run(ref);
          }
        } else if (s.status === 'EXPIRED' || s.status === 'CANCELLED') {
          q.marquerEchec.run(ref);
        } else if (s.transaction_status === 'FAILED' || s.transaction_status === 'CANCELLED') {
          // La tentative a échoué, mais le client peut réessayer sur la même page SasPay.
          return { etat: 'echec', type: cmd.type, reessayable: true };
        }
        cmd = q.commande.get(ref);
      }

      if (cmd.statut === 'ECHEC') return { etat: 'echec', type: cmd.type };
      if (cmd.statut === 'EN_ATTENTE') return { etat: 'en_attente', type: cmd.type };

      const code = await assurerCode(cmd);
      const membre = q.membre.get(cmd.email);
      return {
        etat: 'confirme',
        type: cmd.type,
        code,
        accesJusquAu: membre && membre.acces_jusqu_au,
        nom: cmd.nom,
        email: cmd.email,
      };
    },

    // Webhook : la transaction SasPay ne porte pas notre ref, on passe par la session.
    async traiterTransaction(idTransaction) {
      const session = await saspay.trouverSessionParTransaction(idTransaction);
      if (!session) return null;
      const ref = (session.metadata && session.metadata.ref) || (q.commandeParSession.get(session.id) || {}).ref;
      if (!ref || !q.commande.get(ref)) return null;
      return { ref, ...(await this.etat(ref)) };
    },
  };
}

module.exports = { creerCommandes };

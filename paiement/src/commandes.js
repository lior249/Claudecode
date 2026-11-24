'use strict';

const crypto = require('crypto');
const { paiementConforme } = require('./acces');

const JOUR_MS = 24 * 3600 * 1000;

// Logique métier : commandes (inscription / renouvellement) des offres Community et Elite,
// vérification des paiements SasPay, création et prolongation des accès.
// Idempotente : le webhook ET la page de statut peuvent l'appeler autant de fois que nécessaire.
function creerCommandes({ db, saspay, whop, config, envoyerEmail, maintenant = () => new Date() }) {
  const q = {
    insererCommande: db.prepare(`INSERT INTO commandes (ref, programme, type, email, nom, telephone, montant, devise, invitation_token, cree_le)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    lierSession: db.prepare('UPDATE commandes SET saspay_session_id = ? WHERE ref = ?'),
    commande: db.prepare('SELECT * FROM commandes WHERE ref = ?'),
    commandeParSession: db.prepare('SELECT * FROM commandes WHERE saspay_session_id = ?'),
    marquerPayee: db.prepare(`UPDATE commandes SET statut = 'PAYEE', saspay_tx_id = ?, payee_le = ?
                              WHERE ref = ? AND statut = 'EN_ATTENTE'`),
    marquerEchec: db.prepare(`UPDATE commandes SET statut = 'ECHEC' WHERE ref = ? AND statut = 'EN_ATTENTE'`),
    marquerEmail: db.prepare('UPDATE commandes SET code_promo = ? WHERE ref = ? AND code_promo IS NULL'),
    membre: db.prepare('SELECT * FROM membres WHERE programme = ? AND email = ?'),
    membreParId: db.prepare('SELECT * FROM membres WHERE id = ?'),
    membresParDiscord: db.prepare('SELECT * FROM membres WHERE discord_id = ? ORDER BY programme'),
    insererMembre: db.prepare(`INSERT INTO membres (programme, email, nom, telephone, prix_renouvellement, devise, acces_jusqu_au, statut, cree_le, maj_le)
                               VALUES (?, ?, ?, ?, ?, ?, ?, 'actif', ?, ?)`),
    reactiverMembre: db.prepare(`UPDATE membres SET nom = ?, telephone = COALESCE(?, telephone), prix_renouvellement = ?, devise = ?,
                                 acces_jusqu_au = ?, statut = 'actif', whop_entry_id = NULL, whop_membership_id = NULL, whop_annule_le = NULL,
                                 whop_jours_a_ajouter = 0, categorie_elite = NULL, maj_le = ? WHERE id = ?`),
    prolongerMembre: db.prepare(`UPDATE membres SET acces_jusqu_au = ?, whop_jours_a_ajouter = whop_jours_a_ajouter + ?, maj_le = ?
                                 WHERE id = ?`),
    lierDiscord: db.prepare('UPDATE membres SET discord_id = ?, discord_pseudo = ?, maj_le = ? WHERE id = ?'),
    invitation: db.prepare('SELECT * FROM invitations_elite WHERE token = ?'),
    insererInvitation: db.prepare('INSERT INTO invitations_elite (token, note, cree_le) VALUES (?, ?, ?)'),
    utiliserInvitation: db.prepare('UPDATE invitations_elite SET utilisee_le = ?, ref_commande = ? WHERE token = ? AND utilisee_le IS NULL'),
  };

  const offre = (programme) => {
    const o = config.offres[programme];
    if (!o) throw new Error(`Offre inconnue : ${programme}`);
    return o;
  };

  function finDans(jours, depuis) {
    const now = maintenant();
    const depart = depuis && new Date(depuis) > now ? new Date(depuis) : now;
    return new Date(depart.getTime() + jours * JOUR_MS).toISOString();
  }

  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  // Passe la commande en PAYEE et applique son effet (accès créé, réactivé ou prolongé), en une transaction.
  function finaliser(cmd, idTransaction) {
    return transaction(() => {
      const iso = maintenant().toISOString();
      if (q.marquerPayee.run(idTransaction, iso, cmd.ref).changes !== 1) return false; // déjà traitée
      const o = offre(cmd.programme);
      const membre = q.membre.get(cmd.programme, cmd.email);
      const prixGaranti = Number(o.prixRenouvellement).toFixed(2);
      if (cmd.type === 'inscription') {
        if (membre) {
          // Retour d'un ancien membre (ou nouvelle inscription) : nouveau départ au tarif actuel.
          const fin = membre.statut === 'actif' ? finDans(o.dureeJours, membre.acces_jusqu_au) : finDans(o.dureeJours);
          if (membre.statut === 'actif') q.prolongerMembre.run(fin, membre.whop_membership_id ? o.dureeJours : 0, iso, membre.id);
          else q.reactiverMembre.run(cmd.nom, cmd.telephone, prixGaranti, config.devise, fin, iso, membre.id);
        } else {
          q.insererMembre.run(cmd.programme, cmd.email, cmd.nom, cmd.telephone, prixGaranti, config.devise, finDans(o.dureeJours), iso, iso);
        }
        if (cmd.invitation_token) q.utiliserInvitation.run(iso, cmd.ref, cmd.invitation_token);
      } else if (membre) {
        q.prolongerMembre.run(finDans(o.dureeJours, membre.acces_jusqu_au), membre.whop_membership_id ? o.dureeJours : 0, iso, membre.id);
      }
      return true;
    });
  }

  async function emailConfirmation(cmd) {
    if (!envoyerEmail || q.marquerEmail.run('email', cmd.ref).changes !== 1) return;
    try {
      const o = offre(cmd.programme);
      await envoyerEmail({
        email: cmd.email, nom: cmd.nom, type: cmd.type, nomOffre: o.nom,
        lienGuide: `${config.baseUrl}/acces/${cmd.ref}`,
      });
    } catch (err) { console.error('[email]', err.message); }
  }

  return {
    db,
    offre,

    membre(programme, email) {
      return q.membre.get(programme, String(email || '').trim().toLowerCase()) || null;
    },
    membreParId(id) { return q.membreParId.get(id) || null; },
    membresParDiscord(discordId) { return q.membresParDiscord.all(discordId); },

    // Montant à payer : prix d'entrée actuel, ou prix de renouvellement garanti du membre.
    montantPour(programme, type, email) {
      const o = offre(programme);
      if (type === 'inscription') return Number(o.prixEntree).toFixed(2);
      const m = this.membre(programme, email);
      return Number((m && m.prix_renouvellement) || o.prixRenouvellement).toFixed(2);
    },

    // Renouvellement possible seulement avant la fin de l'accès.
    peutRenouveler(programme, email) {
      const m = this.membre(programme, email);
      return Boolean(m && m.statut === 'actif' && new Date(m.acces_jusqu_au) > maintenant());
    },

    invitation(token) {
      return (typeof token === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(token) && q.invitation.get(token)) || null;
    },
    creerInvitation(note) {
      const token = crypto.randomBytes(18).toString('base64url');
      q.insererInvitation.run(token, note || null, maintenant().toISOString());
      return { token, lien: `${config.baseUrl}${config.offres.elite.base}/paiement/${token}` };
    },

    // Crée la commande en base puis la session de paiement SasPay. Renvoie l'URL de paiement.
    async demarrer({ programme = 'community', type, email, nom, telephone, invitationToken }) {
      const o = offre(programme);
      const ref = crypto.randomBytes(16).toString('base64url');
      const montant = this.montantPour(programme, type, email);
      q.insererCommande.run(ref, programme, type, email, nom, telephone || null, montant, config.devise,
        invitationToken || null, maintenant().toISOString());

      const corps = {
        amount: montant,
        currency: config.devise,
        description: type === 'inscription' ? `${o.nom} — inscription` : `${o.nom} — renouvellement`,
        customer_email: email,
        customer_name: nom,
        return_url: `${config.baseUrl}/confirmation/${ref}`,
        metadata: { ref, type, programme },
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
          return { etat: 'echec', type: cmd.type, programme: cmd.programme, reessayable: true };
        }
        cmd = q.commande.get(ref);
      }

      if (cmd.statut === 'ECHEC') return { etat: 'echec', type: cmd.type, programme: cmd.programme };
      if (cmd.statut === 'EN_ATTENTE') return { etat: 'en_attente', type: cmd.type, programme: cmd.programme };

      await emailConfirmation(cmd);
      const membre = q.membre.get(cmd.programme, cmd.email);
      return {
        etat: 'confirme',
        type: cmd.type,
        programme: cmd.programme,
        accesJusquAu: membre && membre.acces_jusqu_au,
        membre,
        nom: cmd.nom,
        email: cmd.email,
      };
    },

    // Ce que le client a rempli, pour l'onglet « Détails » de la page de statut.
    details(ref) {
      const c = q.commande.get(ref);
      if (!c) return null;
      return {
        ref: c.ref, type: c.type, programme: c.programme, nom: c.nom, email: c.email, telephone: c.telephone,
        montant: c.montant, devise: c.devise, creeLe: c.cree_le, payeeLe: c.payee_le,
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

    // Relie le compte Discord au membre de la commande payée.
    lierDiscord(ref, discordId, pseudo) {
      const cmd = q.commande.get(ref);
      if (!cmd || cmd.statut !== 'PAYEE') return null;
      const membre = q.membre.get(cmd.programme, cmd.email);
      if (!membre) return null;
      q.lierDiscord.run(discordId, pseudo || null, maintenant().toISOString(), membre.id);
      return q.membreParId.get(membre.id);
    },

    // Prolongation gratuite (lien de grâce, Elite « insatisfait ») : base + Whop.
    prolongerGratuitement(membreId, jours) {
      const m = q.membreParId.get(membreId);
      if (!m) return null;
      const iso = maintenant().toISOString();
      q.prolongerMembre.run(finDans(jours, m.acces_jusqu_au), m.whop_membership_id ? jours : 0, iso, m.id);
      return q.membreParId.get(m.id);
    },
  };
}

module.exports = { creerCommandes, JOUR_MS };

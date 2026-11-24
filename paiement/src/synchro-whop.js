'use strict';

const { emailDeLaDemande } = require('./whop');
const { JOUR_MS } = require('./commandes');

// Toutes les minutes :
//  1. accepte les demandes de la liste d'attente Whop dont l'email correspond à un paiement réussi ;
//  2. refuse celles qui ne correspondent à rien au bout de 48 h (et prévient l'admin) ;
//  3. récupère l'accès Whop créé et l'aligne sur la date de fin payée ;
//  4. applique les prolongations en attente (renouvellements payés).
function creerSynchroWhop({ db, whop, config, notifier = {}, maintenant = () => new Date() }) {
  const q = {
    membre: db.prepare('SELECT * FROM membres WHERE programme = ? AND email = ?'),
    marquerDemande: db.prepare('UPDATE membres SET whop_entry_id = ?, maj_le = ? WHERE id = ?'),
    enAttenteMembership: db.prepare("SELECT * FROM membres WHERE whop_entry_id IS NOT NULL AND whop_membership_id IS NULL AND statut = 'actif'"),
    marquerMembership: db.prepare('UPDATE membres SET whop_membership_id = ?, whop_jours_a_ajouter = whop_jours_a_ajouter + ?, maj_le = ? WHERE id = ?'),
    aProlonger: db.prepare("SELECT * FROM membres WHERE whop_membership_id IS NOT NULL AND whop_jours_a_ajouter > 0 AND statut = 'actif'"),
    prolonge: db.prepare('UPDATE membres SET whop_jours_a_ajouter = whop_jours_a_ajouter - ?, maj_le = ? WHERE id = ?'),
  };
  const log = (...a) => console.log('[whop]', ...a);
  const admin = (t) => notifier.admin && notifier.admin(t).catch?.((e) => console.error('[whop] notif', e.message));

  async function traiterDemandes(o) {
    const demandes = await whop.demandesEnAttente(o.whopPlanId);
    const now = maintenant();
    for (const d of demandes) {
      try {
        const email = emailDeLaDemande(d);
        const m = email ? q.membre.get(o.id, email) : null;
        const valable = m && m.statut === 'actif' && new Date(m.acces_jusqu_au) > now && !m.whop_membership_id
          && (!m.whop_entry_id || m.whop_entry_id === d.id);
        if (valable) {
          await whop.accepter(d.id);
          q.marquerDemande.run(d.id, now.toISOString(), m.id);
          log(`demande ${d.id} acceptée (${o.id}, ${email})`);
          if (notifier.membre && m.discord_id) {
            notifier.membre(m.discord_id, `Ton accès Whop à **${o.nom}** est validé. Ouvre Whop pour commencer la formation.`).catch(() => {});
          }
        } else if (now - new Date(d.created_at) > config.whop.refusApresHeures * 3600 * 1000) {
          await whop.refuser(d.id);
          log(`demande ${d.id} refusée (${o.id}, ${email || 'sans email'})`);
          const qui = d.user && (d.user.username || d.user.name) ? ` (compte Whop : ${d.user.username || d.user.name})` : '';
          admin(`Demande Whop **${o.nom}** refusée après ${config.whop.refusApresHeures} h${qui} : l'email « ${email || 'aucun'} » ne correspond à aucun paiement mobile money valide.`);
        }
      } catch (err) {
        console.error(`[whop] demande ${d.id} :`, err.message);
      }
    }
  }

  async function recupererAcces() {
    for (const m of q.enAttenteMembership.all()) {
      try {
        const d = await whop.demande(m.whop_entry_id);
        if (!d || !d.membership_id) continue;
        const o = config.offres[m.programme];
        // Whop donne `dureeJours` à partir de l'acceptation ; on ajoute la différence si le membre a payé plus loin.
        const finWhop = maintenant().getTime() + o.dureeJours * JOUR_MS;
        const surplus = Math.max(0, Math.ceil((new Date(m.acces_jusqu_au).getTime() - finWhop) / JOUR_MS));
        q.marquerMembership.run(d.membership_id, surplus, maintenant().toISOString(), m.id);
        log(`accès ${d.membership_id} relié au membre ${m.id}${surplus ? ` (+${surplus} j à ajouter)` : ''}`);
      } catch (err) {
        console.error(`[whop] membre ${m.id} :`, err.message);
      }
    }
  }

  async function appliquerProlongations() {
    for (const m of q.aProlonger.all()) {
      try {
        const jours = Math.min(m.whop_jours_a_ajouter, 1095);
        await whop.prolonger(m.whop_membership_id, jours);
        q.prolonge.run(jours, maintenant().toISOString(), m.id);
        log(`accès ${m.whop_membership_id} prolongé de ${jours} j`);
      } catch (err) {
        console.error(`[whop] prolongation membre ${m.id} :`, err.message);
      }
    }
  }

  return {
    async executer() {
      for (const o of Object.values(config.offres)) {
        if (!o.whopPlanId) continue;
        try { await traiterDemandes(o); } catch (err) { console.error(`[whop] liste d'attente ${o.id} :`, err.message); }
      }
      await recupererAcces();
      await appliquerProlongations();
    },
  };
}

module.exports = { creerSynchroWhop };

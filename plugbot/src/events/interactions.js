// Clics sur les boutons, choix dans les menus et formulaires du panneau et des tickets.
// Seul l'admin peut s'en servir.

import { MessageFlags } from 'discord.js';
import { REMINDERS } from './catalog.js';
import { parseDate, parseDuration, parseTime } from './format.js';
import { cancelConfirmation, infoModal, linkModal, parseCustomId } from './ui.js';

const PRIVATE = MessageFlags.Ephemeral;

// Lit le formulaire « Sujet, date, heure ». Renvoie les changements, ou la liste des erreurs.
export function readInfoForm(fields, now) {
  const errors = [];
  const title = fields.title.trim();
  const day = parseDate(fields.date, now);
  const time = parseTime(fields.time);
  const durationMin = parseDuration(fields.duration);
  if (!title) errors.push('le sujet est vide');
  if (day === null) errors.push(`la date « ${fields.date} » n'est pas valable (exemple : 05/11)`);
  if (time === null) errors.push(`l'heure « ${fields.time} » n'est pas valable (exemple : 22:00)`);
  if (durationMin === null) errors.push(`la durée « ${fields.duration} » n'est pas valable (exemple : 60)`);
  if (errors.length > 0) return { errors };
  return { changes: { title, startAt: day + time, durationMin, details: fields.details.trim() } };
}

export function createInteractionHandler({ config, events }, service) {
  async function privately(interaction, content, extra = {}) {
    const payload = { content, flags: PRIVATE, ...extra };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }

  // Enregistre un réglage du ticket, puis met le ticket à jour.
  async function setAndRefresh(interaction, eventId, changes) {
    await interaction.deferUpdate();
    events.update(eventId, changes);
    await service.refreshTicket(eventId);
  }

  async function handle(interaction) {
    const parsed = parseCustomId(interaction.customId ?? '');
    if (!parsed) return;
    if (!config.adminIds.has(interaction.user.id)) {
      await privately(interaction, "Ce panneau est réservé à l'admin.");
      return;
    }
    const { action, eventId } = parsed;
    const now = Date.now();
    const event = eventId ? events.get(eventId) : null;
    if (eventId && !event) {
      await privately(interaction, "Cet événement n'existe plus.");
      return;
    }

    if (action.startsWith('open-') || action === 'openMany') {
      await interaction.deferReply({ flags: PRIVATE });
      const types = action === 'openMany' ? interaction.values : [action.slice('open-'.length)];
      const threads = [];
      for (const type of types) threads.push(await service.openTicket(type, now));
      await interaction.editReply(`🎫 Ticket ouvert : ${threads.map((thread) => `<#${thread.id}>`).join(' ')}`);
      return;
    }

    switch (action) {
      case 'planningDone':
        service.markPlanningDone(now);
        await privately(interaction, '✅ Planning terminé : plus de relance cette semaine. Les rappels partiront aux heures prévues.');
        return;
      case 'list':
        await privately(interaction, service.upcomingList());
        return;
      case 'audience':
        await setAndRefresh(interaction, eventId, { audience: interaction.values[0], template: 0 });
        return;
      case 'location':
        await setAndRefresh(interaction, eventId, { locationChannel: interaction.values[0] ?? null, locationUrl: null });
        return;
      case 'template':
        await setAndRefresh(interaction, eventId, { template: Number(interaction.values[0]) });
        return;
      case 'roles':
        await setAndRefresh(interaction, eventId, { roles: interaction.values });
        return;
      case 'reminders': {
        const order = Object.keys(REMINDERS);
        const reminders = [...interaction.values].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        await setAndRefresh(interaction, eventId, { reminders });
        return;
      }
      case 'info':
        await interaction.showModal(infoModal(event));
        return;
      case 'infoSubmit': {
        const field = (id) => interaction.fields.getTextInputValue(id) ?? '';
        const form = readInfoForm(
          { title: field('title'), date: field('date'), time: field('time'), duration: field('duration'), details: field('details') },
          now,
        );
        if (form.errors) {
          await privately(interaction, `⚠️ Rien n'a été enregistré : ${form.errors.join(' ; ')}.`);
          return;
        }
        await setAndRefresh(interaction, eventId, form.changes);
        return;
      }
      case 'link':
        await interaction.showModal(linkModal(event));
        return;
      case 'linkSubmit': {
        const url = interaction.fields.getTextInputValue('url').trim();
        if (!/^https?:\/\/\S+$/i.test(url)) {
          await privately(interaction, '⚠️ Le lien doit commencer par https://');
          return;
        }
        await setAndRefresh(interaction, eventId, { locationUrl: url, locationChannel: null });
        return;
      }
      case 'preview':
        await interaction.deferUpdate();
        await service.preview(eventId, now);
        return;
      case 'validate':
      case 'save': {
        await interaction.deferUpdate();
        const error = action === 'validate' ? await service.validate(eventId, now) : await service.saveChanges(eventId, now);
        await privately(interaction, error ? `⚠️ ${error}` : action === 'validate' ? "✅ Événement programmé : l'annonce est partie et les rappels sont prêts." : '💾 Changements enregistrés.');
        return;
      }
      case 'delete':
        await interaction.deferUpdate();
        await service.deleteDraft(eventId);
        return;
      case 'cancel':
        await privately(interaction, cancelConfirmation(event).content, { components: cancelConfirmation(event).components });
        return;
      case 'cancelConfirm':
        await interaction.deferUpdate();
        await service.cancel(eventId);
        return;
      default:
        await privately(interaction, 'Action inconnue.');
    }
  }

  return async function onInteraction(interaction) {
    try {
      await handle(interaction);
    } catch (error) {
      console.error('[PlugBot] Erreur dans le panneau :', error);
      await privately(interaction, `⚠️ Erreur : ${error.message}`).catch(() => {});
    }
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { CoachingError, decideReactivation, requestReactivation } from "@/server/coaching/lifecycle";
import {
  acknowledgeAdvice,
  closeTicket,
  openLearnerTicket,
  postMessage,
  rateTicket,
  reportOutcome,
  sendFollowUps,
} from "@/server/coaching/tickets";
import {
  addPost,
  updateCoachingProfile,
} from "@/server/coaching/progress";
import { addCoach, NeedsForceError, removeCoach, setCoachCapacity } from "@/server/coaching/admin";
import { setAvailability } from "@/server/coaching/availability";

type Result = { ok: true; id?: string } | { ok: false; error: string };
const id = z.string().min(1).max(64);
const images = z.array(z.string().max(200)).max(4).default([]);
const COACHES = ["COACH", "ADMIN"] as const;
// Posts, preuves et profil TikTok : élèves en coaching et équipe (le service vérifie que l'espace est actif).
const PARTICIPANTS = ["LEARNER", "COACH", "ADMIN"] as const;

async function run<S extends z.ZodTypeAny>(
  roles: readonly ("LEARNER" | "COACH" | "ADMIN")[] | null,
  schema: S,
  raw: unknown,
  fn: (user: { id: string; role: string }, data: z.infer<S>) => Promise<unknown>,
): Promise<Result> {
  const user = await requireUser(roles ? [...roles] : undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  let out: unknown;
  try {
    out = await fn(user, parsed.data);
  } catch (e) {
    if (e instanceof CoachingError) return { ok: false, error: e.message };
    console.error("[coaching]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath("/coaching", "layout");
  revalidatePath("/coach", "layout");
  return { ok: true, id: (out as { id?: string } | undefined)?.id };
}

// ---------- Élève ----------

export const saveProfileAction = async (raw: unknown) =>
  run(PARTICIPANTS, z.object({ tiktokUsername: z.string().max(40), timezone: z.string().max(60) }), raw, (u, d) => updateCoachingProfile(u.id, d));

export const addPostAction = async (raw: unknown) => run(PARTICIPANTS, z.object({ url: z.string().max(500) }), raw, (u, d) => addPost(u.id, d.url));

export const openTicketAction = async (raw: unknown) =>
  run(["LEARNER"], z.object({ subject: z.string().max(200), body: z.string().max(5000), imageKeys: images }), raw, (u, d) => openLearnerTicket(u.id, d));

export const ackAdviceAction = async (raw: unknown) => run(["LEARNER"], z.object({ messageId: id }), raw, (u, d) => acknowledgeAdvice(u.id, d.messageId));

export const outcomeAction = async (raw: unknown) =>
  run(["LEARNER"], z.object({ messageId: id, worked: z.boolean(), comment: z.string().max(2000) }), raw, (u, d) => reportOutcome(u.id, d.messageId, d.worked, d.comment));

export const rateTicketAction = async (raw: unknown) =>
  run(["LEARNER"], z.object({ ticketId: id, rating: z.enum(["BAD", "NEUTRAL", "GOOD"]), comment: z.string().max(2000) }), raw, (u, d) =>
    rateTicket(u.id, d.ticketId, d.rating, d.comment),
  );

export const reactivationAction = async (raw: unknown) => run(["LEARNER"], z.object({ reason: z.string().max(2000) }), raw, (u, d) => requestReactivation(u.id, d.reason));

// ---------- Élève et coach ----------

export const postMessageAction = async (raw: unknown) =>
  run(null, z.object({ ticketId: id, body: z.string().max(5000), imageKeys: images, followUpHours: z.number().int().nullable().optional() }), raw, (u, d) =>
    postMessage(u, d.ticketId, d),
  );

// ---------- Coach ----------

export const closeTicketAction = async (raw: unknown) => run(COACHES, z.object({ ticketId: id }), raw, (u, d) => closeTicket(u, d.ticketId));

export const followUpsAction = async (raw: unknown) =>
  run(COACHES, z.object({ templateKey: z.string().max(40), learnerIds: z.array(id).min(1, "Choisis au moins un élève.").max(200) }), raw, (u, d) =>
    sendFollowUps(u.id, d.templateKey, d.learnerIds),
  );

export const reactivationDecisionAction = async (raw: unknown) =>
  run(COACHES, z.object({ requestId: id, accept: z.boolean() }), raw, (u, d) => decideReactivation(u.id, d.requestId, d.accept));

// ---------- Admin ----------

export const capacityAction = async (raw: unknown) =>
  run(["ADMIN"], z.object({ coachId: id, capacity: z.number().int() }), raw, (u, d) => setCoachCapacity(u.id, d.coachId, d.capacity));

// Nommer un coach. Sans formation terminée : on renvoie needsForce, l'admin confirme puis on rappelle avec force.
export async function addCoachAction(raw: unknown): Promise<Result | { ok: false; error: string; needsForce: true }> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z.object({ userId: id, force: z.boolean().default(false) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    await addCoach(user.id, parsed.data.userId, parsed.data.force);
  } catch (e) {
    if (e instanceof NeedsForceError) return { ok: false, error: e.message, needsForce: true };
    if (e instanceof CoachingError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export const removeCoachAction = async (raw: unknown) => run(["ADMIN"], z.object({ coachId: id }), raw, (u, d) => removeCoach(u.id, d.coachId));

const slotSchema = z.object({ weekday: z.number().int(), start: z.string().max(5), end: z.string().max(5) });

export const availabilityAction = async (raw: unknown) =>
  run(COACHES, z.object({ slots: z.array(slotSchema).max(21) }), raw, (u, d) => setAvailability(u.id, d.slots));

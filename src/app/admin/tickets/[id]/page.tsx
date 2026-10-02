import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { CoachingError } from "@/server/coaching/lifecycle";
import { getTicketView } from "@/server/coaching/tickets";
import { TicketChat } from "@/components/coaching/ticket-chat";

// Relecture d'un échange par l'Admin (lecture seule).
export default async function AdminTicketPage({ params }: PageProps<"/admin/tickets/[id]">) {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  let ticket;
  try {
    ticket = await getTicketView({ id: user.id, role: "ADMIN" }, id);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  // L'admin qui est aussi le coach de ce ticket le voit en lecture seule ici.
  const readOnly = { ...ticket, viewerIs: "ADMIN" as const };
  return (
    <div className="mx-auto max-w-md">
      <Link href="/admin/coaches" className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Coachs
      </Link>
      <h1 className="text-xl font-semibold">{ticket.subject}</h1>
      <p className="mb-4 text-sm text-muted">
        {ticket.learner.displayName} ↔ {ticket.coach.displayName} · ouvert le {new Date(ticket.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
      </p>
      <TicketChat ticket={readOnly} />
    </div>
  );
}

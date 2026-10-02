import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { CoachingError } from "@/server/coaching/lifecycle";
import { getTicketView } from "@/server/coaching/tickets";
import { TicketChat } from "@/components/coaching/ticket-chat";

export default async function CoachTicketPage({ params }: PageProps<"/coach/tickets/[id]">) {
  const user = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  let ticket;
  try {
    ticket = await getTicketView(user, id);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-md">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/coach" className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {ticket.learner.displayName} · {ticket.origin === "COACH" ? "ticket de suivi" : "demande de l'élève"}
          </p>
          <h1 className="truncate font-semibold">{ticket.subject}</h1>
        </div>
      </header>
      <TicketChat ticket={ticket} />
    </div>
  );
}

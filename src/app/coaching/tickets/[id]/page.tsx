import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { CoachingError } from "@/server/coaching/lifecycle";
import { getTicketView } from "@/server/coaching/tickets";
import { TicketChat } from "@/components/coaching/ticket-chat";

export default async function LearnerTicketPage({ params }: PageProps<"/coaching/tickets/[id]">) {
  const user = await requireUser(["LEARNER"]);
  const { id } = await params;
  let ticket;
  try {
    ticket = await getTicketView(user, id);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <header className="flex items-center gap-3 py-5">
        <Link href="/coaching" className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-muted">{ticket.origin === "COACH" ? "Question de ton coach" : "Ta demande"} · {ticket.coach.displayName}</p>
          <h1 className="line-clamp-2 break-words leading-snug font-semibold">{ticket.subject}</h1>
        </div>
      </header>
      <TicketChat ticket={ticket} />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewTicketForm } from "@/components/coaching/new-ticket-form";

export default function NewTicketPage() {
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <header className="flex items-center gap-3 py-5">
        <Link href="/coaching" className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold">Nouvelle demande à ton coach</h1>
      </header>
      <NewTicketForm />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountBar } from "@/components/profile/account-bar";
import type { MenuUser } from "@/components/profile/user-menu";

// En-tête d'une page : retour + titre (+ cloche et compte sur téléphone ; sur PC, le menu de gauche les remplace).
export function PageHeader({ title, back, account, children }: { title: string; back: string; account: { user: MenuUser; unread: number }; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={back} className="rounded-full bg-card p-2 text-muted lg:hidden" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="line-clamp-2 break-words text-2xl font-semibold leading-tight lg:text-3xl lg:font-bold">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <div className="lg:hidden">
          <AccountBar {...account} />
        </div>
      </div>
    </header>
  );
}

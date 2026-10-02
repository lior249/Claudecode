import Link from "next/link";
import { requireUser } from "@/server/auth/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUser(["ADMIN"]);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/admin" className="flex items-baseline gap-2">
          <span className="logo text-3xl">Creato</span>
          <span className="text-sm font-medium text-gold">Admin</span>
        </Link>
        <Link href="/learn" className="rounded-full bg-card px-3 py-2 text-xs text-muted">
          Vue élève
        </Link>
      </header>
      <nav className="mb-6 flex gap-1 rounded-2xl bg-card p-1 text-sm">
        <Link href="/admin" className="flex-1 rounded-xl py-2.5 text-center">
          Parcours
        </Link>
        <Link href="/admin/learners" className="flex-1 rounded-xl py-2.5 text-center">
          Élèves
        </Link>
        <Link href="/admin/reviews" className="flex-1 rounded-xl py-2.5 text-center">
          Validations
        </Link>
        <Link href="/admin/catalogs" className="flex-1 rounded-xl py-2.5 text-center">
          Catalogues
        </Link>
      </nav>
      {children}
    </div>
  );
}

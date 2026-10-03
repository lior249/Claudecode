import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { AccountBar } from "@/components/profile/account-bar";
import { TabNav } from "@/components/tab-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser(["ADMIN"]);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/admin" className="flex items-baseline gap-2">
          <span className="logo text-3xl">Creato</span>
          <span className="text-sm font-medium text-gold">Admin</span>
        </Link>
        <AccountBar {...await accountBarData(user)} />
      </header>
      <TabNav
        tabs={[
          ["/admin", "Parcours"],
          ["/admin/learners", "Élèves"],
          ["/admin/reviews", "Validations"],
          ["/admin/catalogs", "Catalogues"],
          ["/admin/coaches", "Coachs"],
        ]}
      />
      {children}
    </div>
  );
}

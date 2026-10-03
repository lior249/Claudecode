import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { getCurrentUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { canParticipate } from "@/server/coaching/team";
import { AppShell } from "@/components/shell/app-shell";
import { VIEW_COOKIE, VIEWS, type SidebarData, type ViewName } from "@/components/shell/view";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Creato",
  description: "Ta progression Learn",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

// Menu de gauche (PC) : seulement pour un membre connecté.
async function sidebarData(): Promise<SidebarData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { user: account, unread } = await accountBarData(user);
  const saved = (await cookies()).get(VIEW_COOKIE)?.value;
  const lastView = VIEWS.find((v) => v === saved && account.views.some((x) => x.label === v)) ?? (account.views.at(-1)!.label as ViewName);
  return {
    name: account.name,
    avatarUrl: account.avatarUrl,
    unread,
    views: account.views,
    participant: canParticipate(user),
    coachStars: user.role === "LEARNER" ? null : user.coachStars,
    lastView,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell data={await sidebarData()}>{children}</AppShell>
      </body>
    </html>
  );
}

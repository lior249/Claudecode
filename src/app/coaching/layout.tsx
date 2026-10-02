import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { canParticipate, ensureTeamParticipation } from "@/server/coaching/team";

export default async function CoachingLayout({ children }: LayoutProps<"/coaching">) {
  const user = await requireUser();
  if (!canParticipate(user)) redirect("/learn");
  await ensureTeamParticipation(user);
  return <main className="mx-auto min-h-dvh max-w-md px-4 pb-24">{children}</main>;
}

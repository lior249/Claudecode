import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";

export default async function CoachingLayout({ children }: LayoutProps<"/coaching">) {
  const user = await requireUser(["LEARNER"]);
  if (user.coachingStatus === "NONE") redirect("/learn");
  return <main className="mx-auto min-h-dvh max-w-md px-4 pb-24">{children}</main>;
}

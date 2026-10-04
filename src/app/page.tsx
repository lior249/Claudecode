import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/bienvenue");
  redirect(user.role === "COACH" ? "/coach" : user.role === "LEARNER" && user.coachingStatus !== "NONE" ? "/coaching" : "/learn");
}

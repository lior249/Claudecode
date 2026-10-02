import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import { parseLaunchConfig } from "@/server/launch/rules";
import { LaunchEditor } from "@/components/admin/launch-editor";

export default async function AdminLaunchPage({ params }: PageProps<"/admin/launch/[lessonId]">) {
  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: { select: { title: true } } } });
  if (!lesson || lesson.type !== "CODE_VALIDATION") notFound();
  const config = parseLaunchConfig(lesson.config);
  const reports = await prisma.launchReport.count({ where: { lessonId } });
  return (
    <div>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Parcours
      </Link>
      <h1 className="text-2xl font-semibold">{lesson.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {lesson.module.title} · {reports} élève{reports > 1 ? "s" : ""} passé{reports > 1 ? "s" : ""} en coaching
      </p>
      <LaunchEditor lessonId={lesson.id} initial={{ summary: lesson.summary, ...config }} />
    </div>
  );
}

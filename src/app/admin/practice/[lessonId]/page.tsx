import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import { parsePracticeConfig } from "@/server/practice/config";
import { PracticeEditor } from "@/components/admin/practice-editor";

export default async function AdminPracticePage({ params }: PageProps<"/admin/practice/[lessonId]">) {
  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: { select: { title: true } } } });
  if (!lesson || (lesson.type !== "PRACTICE_AI" && lesson.type !== "PRACTICE_HUMAN")) notFound();
  const config = parsePracticeConfig(lesson.config);

  return (
    <div>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Parcours
      </Link>
      <h1 className="text-2xl font-semibold">{lesson.title}</h1>
      <p className="mt-1 text-sm text-muted">{lesson.module.title} · Pratique corrigée à la main (coach ou admin) · {config.threshold}/10 pour valider</p>
      <PracticeEditor
        lessonId={lesson.id}
        initial={{
          summary: lesson.summary,
          accept: config.accept,
          criteria: config.criteria,
        }}
      />
    </div>
  );
}

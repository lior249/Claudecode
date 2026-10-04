import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getResultType } from "@/server/results/service";
import { ResultTypeEditor } from "@/components/admin/result-type-editor";

export default async function AdminResultType({ params }: PageProps<"/admin/results/[id]">) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const type = id === "new" ? null : await getResultType(id);
  if (id !== "new" && !type) notFound();
  return (
    <div>
      <Link href="/admin/results" className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Types de résultats
      </Link>
      <h1 className="text-2xl font-semibold">{type ? type.name : "Nouveau type de résultat"}</h1>
      <ResultTypeEditor initial={type} />
    </div>
  );
}

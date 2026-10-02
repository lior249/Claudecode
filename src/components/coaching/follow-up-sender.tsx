"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { followUpsAction } from "@/app/actions/coaching";

export function FollowUpSender({ templates, learners }: { templates: { key: string; subject: string; body: string }[]; learners: { id: string; name: string; busy: boolean }[] }) {
  const router = useRouter();
  const [template, setTemplate] = useState(templates[0]?.key ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const free = learners.filter((l) => !l.busy);
  const t = templates.find((x) => x.key === template);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {templates.map((x) => (
          <label key={x.key} className={`block cursor-pointer rounded-2xl border p-3 text-sm ${template === x.key ? "border-gold bg-gold/10" : "border-line bg-card"}`}>
            <input type="radio" name="template" className="sr-only" checked={template === x.key} onChange={() => setTemplate(x.key)} />
            <span className="font-semibold">{x.subject}</span>
            <span className="block text-muted">{x.body}</span>
          </label>
        ))}
      </div>
      <div className="rounded-3xl border border-line bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">Élèves</p>
          <button onClick={() => setSelected(selected.length === free.length ? [] : free.map((l) => l.id))} className="text-xs text-muted underline">
            {selected.length === free.length && free.length ? "Tout décocher" : "Tout cocher"}
          </button>
        </div>
        {learners.length === 0 && <p className="text-sm text-muted">Aucun élève en coaching.</p>}
        <ul className="space-y-1">
          {learners.map((l) => (
            <li key={l.id}>
              <label className={`flex items-center gap-3 rounded-xl p-2 text-sm ${l.busy ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  disabled={l.busy}
                  checked={selected.includes(l.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))}
                  className="h-5 w-5 accent-[var(--gold)]"
                />
                <span className="flex-1">{l.name}</span>
                {l.busy && <span className="text-xs text-muted">suivi déjà ouvert</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <button
        disabled={pending || !selected.length || !t}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const res = await followUpsAction({ templateKey: template, learnerIds: selected });
            if (res.ok) {
              setMessage({ ok: true, text: `« ${t?.subject} » envoyé.` });
              setSelected([]);
              router.refresh();
            } else setMessage({ ok: false, text: res.error });
          })
        }
        className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40"
      >
        Envoyer à {selected.length} élève{selected.length > 1 ? "s" : ""}
      </button>
      {message && <p className={`text-center text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
    </div>
  );
}

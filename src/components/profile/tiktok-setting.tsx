"use client";

import { useState, useTransition } from "react";
import { tiktokAction } from "@/app/actions/profile";

export function TiktokSetting({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-semibold">Mon compte TikTok</h2>
      <div className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="@ton_compte" className="min-w-0 flex-1 rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold" />
        <button
          disabled={pending || !value.trim() || value === initial}
          onClick={() =>
            start(async () => {
              const res = await tiktokAction(value);
              setMsg(res.ok ? { ok: true, text: "Enregistré." } : { ok: false, text: res.error });
            })
          }
          className="shrink-0 rounded-2xl bg-text px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}

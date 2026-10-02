"use client";

import { useEffect } from "react";
import { timezoneAction } from "@/app/actions/notifications";

// Enregistre le fuseau du téléphone s'il n'est pas encore connu (rappels à la bonne heure).
export function TimezoneSync({ known }: { known: boolean }) {
  useEffect(() => {
    if (known) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void timezoneAction(tz);
  }, [known]);
  return null;
}

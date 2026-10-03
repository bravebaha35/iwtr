"use client";

import { useEffect, useState } from "react";
import type { EmployerProfileView } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

/**
 * "Show company owner's name during messaging" under Contact & Social Media.
 * Always on: every owner gives their real name when claiming a company, and
 * reviewers see it once the company has replied in a private conversation.
 * Shown as a ticked, locked box so owners know what reviewers see.
 */
export function OwnerNameInMessagesNote() {
  const [ownerName, setOwnerName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<EmployerProfileView>("/me/employer-profile")
      .then((p) => {
        if (!cancelled && p.firstName && p.lastName) setOwnerName(`${p.firstName} ${p.lastName}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" checked disabled readOnly className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
      <span>
        <span className="block text-sm font-medium text-foreground">Show company owner&apos;s name during messaging.</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Always on for every company owner. After your first reply in a private conversation, the reviewer sees
          {ownerName ? ` "${ownerName}"` : " your name"}. You can correct your name in Edit Profile.
        </span>
      </span>
    </label>
  );
}

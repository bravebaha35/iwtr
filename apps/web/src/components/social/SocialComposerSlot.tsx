"use client";

import { useEffect, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { SocialComposer } from "./SocialComposer";
import { notifySocialPosted } from "./socialFeedCache";

export function SocialComposerSlot() {
  const isOwner = useIsCompanyOwner();
  const [companies, setCompanies] = useState<OwnedCompany[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    apiGet<OwnedCompany[]>("/me/owned-companies").then(setCompanies).catch(() => setCompanies([]));
  }, [isOwner]);

  if (!isOwner || !companies || companies.length === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-2xl bg-surface px-5 py-3.5 text-left text-[15px] text-muted-foreground shadow-xs transition hover:shadow-sm"
      >
        Tell us what you think !
      </button>
    );
  }
  return (
    <div>
      <SocialComposer
        companies={companies}
        onPosted={() => {
          setExpanded(false);
          // The lists on the page read themselves again - no page reload.
          notifySocialPosted();
        }}
        onCancel={() => setExpanded(false)}
      />
    </div>
  );
}

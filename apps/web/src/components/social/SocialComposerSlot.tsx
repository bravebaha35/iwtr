"use client";

import { useEffect, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { SocialComposer } from "./SocialComposer";

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
        className="mb-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-surface-muted"
      >
        Tell us what you think !
      </button>
    );
  }
  return (
    <div className="mb-4">
      <SocialComposer
        companies={companies}
        onPosted={() => {
          setExpanded(false);
          // simplest reliable refresh of the feed below
          window.location.reload();
        }}
        onCancel={() => setExpanded(false)}
      />
    </div>
  );
}

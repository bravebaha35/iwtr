"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OwnedCompany, ScheduledSocialPost } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { SocialComposer } from "./SocialComposer";
import { notifySocialPosted } from "./socialFeedCache";
import { formatScheduledTime } from "./socialTime";

export function SocialComposerSlot() {
  const isOwner = useIsCompanyOwner();
  const [companies, setCompanies] = useState<OwnedCompany[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  // The post just set to go out later, so the owner is told where it went.
  const [scheduled, setScheduled] = useState<ScheduledSocialPost | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    apiGet<OwnedCompany[]>("/me/owned-companies").then(setCompanies).catch(() => setCompanies([]));
  }, [isOwner]);

  if (!isOwner || !companies || companies.length === 0) return null;

  if (!expanded) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setScheduled(null);
            setExpanded(true);
          }}
          className="w-full rounded-2xl bg-surface px-5 py-3.5 text-left text-[15px] text-muted-foreground shadow-xs transition hover:shadow-sm"
        >
          Tell us what you think !
        </button>
        {scheduled && (
          <p role="status" className="px-1 text-[13px] text-muted-foreground">
            Scheduled for {formatScheduledTime(scheduled.publishAt)}. It is waiting in your{" "}
            <Link
              href={`/my/companies?company=${scheduled.companyId}&category=social`}
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Dashboard, under IWT Social
            </Link>
            .
          </p>
        )}
      </div>
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
        onScheduled={(post) => {
          setExpanded(false);
          setScheduled(post);
        }}
        onCancel={() => setExpanded(false)}
      />
    </div>
  );
}

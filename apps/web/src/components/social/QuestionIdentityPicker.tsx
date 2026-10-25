"use client";

import { useEffect, useState } from "react";
import type { MemberIdentityMode, SocialQuestionIdentity } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { cachedQuestionIdentity } from "./socialFeedCache";
import { useT } from "@/lib/i18n/client";

// The member's own anonymous name, read once per visit and shared by the ask
// box and every answer box. null until it has arrived (or if it can't be
// read: the choice still works, it just shows no name).
export function useQuestionIdentity(enabled: boolean): SocialQuestionIdentity | null {
  const [identity, setIdentity] = useState<SocialQuestionIdentity | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    cachedQuestionIdentity(() => apiGet<SocialQuestionIdentity>("/social/questions/identity"))
      .then((value) => {
        if (!cancelled) setIdentity(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return identity;
}

/**
 * Which anonymous name to write under: the member's usual one, or a one-off
 * name made up for this question or answer alone. Two tonal buttons; the
 * picked one takes the site's one "selected" colour.
 */
export function QuestionIdentityPicker({
  value,
  onChange,
  identity,
  verb,
}: {
  value: MemberIdentityMode;
  onChange: (next: MemberIdentityMode) => void;
  identity: SocialQuestionIdentity | null;
  // "Ask" or "Answer", for the group's label.
  verb: string;
}) {
  // Questions stay English for now; only the username itself is translated.
  const t = useT();
  const options: { value: MemberIdentityMode; label: string }[] = [
    { value: "PERSONAL_CHOSEN", label: identity?.displayUsername ? t(identity.displayUsername) : "My usual name" },
    { value: "PERSONAL_RANDOM", label: "A one-off name" },
  ];
  return (
    <div role="radiogroup" aria-label={`${verb} as`} className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{verb} as</span>
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(opt.value)}
            className={`max-w-[11rem] truncate rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-[0.98] ${
              checked ? "bg-brand-600 text-white" : "bg-surface-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

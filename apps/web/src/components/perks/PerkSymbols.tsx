"use client";

import { perkDefinition } from "@iwtr/shared-types";
import { FallbackPerkIcon, PERK_ICONS } from "@/lib/perkIcons";
import { useT } from "@/lib/i18n/client";

/**
 * A company's perks as a row of small round symbols (job cards): a hairline
 * circle with the perk's line icon inside, no colour of its own. The name
 * shows when the pointer rests on one, and screen readers hear the list.
 */
export function PerkSymbols({ perks, max = 8, className = "" }: { perks: readonly string[]; max?: number; className?: string }) {
  const t = useT();
  const known = perks.map((k) => perkDefinition(k)).filter((p): p is NonNullable<typeof p> => !!p);
  if (known.length === 0) return null;
  const shown = known.slice(0, max);
  const rest = known.length - shown.length;
  const names = known.map((p) => t(p.en));
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label={`${t("Perks")}: ${names.join(", ")}`}>
      {shown.map((p) => {
        const Icon = PERK_ICONS[p.key as keyof typeof PERK_ICONS] ?? FallbackPerkIcon;
        return (
          <li
            key={p.key}
            title={t(p.en)}
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground ring-1 ring-inset ring-border"
          >
            <Icon size={15} />
          </li>
        );
      })}
      {rest > 0 && (
        <li
          aria-hidden="true"
          title={names.slice(max).join(", ")}
          className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border"
        >
          +{rest}
        </li>
      )}
    </ul>
  );
}

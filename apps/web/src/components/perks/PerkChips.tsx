"use client";

import { perkDefinition } from "@iwtr/shared-types";
import { FallbackPerkIcon, PERK_ICONS } from "@/lib/perkIcons";
import { useT } from "@/lib/i18n/client";

/** A company's perks as small tonal chips (icon + name), for Company Details. */
export function PerkChips({ perks }: { perks: readonly string[] }) {
  const t = useT();
  const known = perks.map((k) => perkDefinition(k)).filter((p): p is NonNullable<typeof p> => !!p);
  if (known.length === 0) return <span className="text-sm text-muted-foreground">{t("No perks listed yet.")}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {known.map((p) => {
        const Icon = PERK_ICONS[p.key as keyof typeof PERK_ICONS] ?? FallbackPerkIcon;
        return (
          <li key={p.key} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[13px] font-medium text-foreground">
            <Icon size={14} aria-hidden="true" className="text-muted-foreground" />
            {t(p.en)}
          </li>
        );
      })}
    </ul>
  );
}

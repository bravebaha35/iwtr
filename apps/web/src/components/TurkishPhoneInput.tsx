"use client";

import { useEffect, useState } from "react";
import { ALL_TURKEY_AREA_CODES, areaCodesForProvince } from "@iwtr/shared-types";
import { SingleSelectDropdown, type DropdownOption } from "@/components/Dropdown";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";

type PhoneKind = "LANDLINE" | "MOBILE";

function digitsOf(value: string): string {
  return value.startsWith("+90") ? value.slice(3) : value.replace(/\D/g, "");
}

function pillClass(active: boolean): string {
  return `rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-brand-600 bg-surface text-brand-700 dark:text-brand-400"
      : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
  }`;
}

/**
 * Turkish company contact-phone entry: a Landline/Mobile toggle. Mobile
 * reuses the existing generic `PhoneNumberInput` (already "+90" + free
 * digits). Landline is a province area-code dropdown (narrowed to
 * `suggestedProvince`'s own code(s) when known, falling back to the full
 * 81-province list otherwise) plus a 7-digit local-number field. Both modes
 * write the same "+90" + 10-digit shape `TurkishPhoneInput`'s value/onChange
 * contract shares with `PhoneNumberInput` — validated against the real area
 * code table server-side by `companyContactPhoneSchema`
 * (packages/shared-types/src/schemas/turkishPhone.ts).
 */
export function TurkishPhoneInput({
  value,
  onChange,
  suggestedProvince,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestedProvince?: string | null;
}) {
  const digits = digitsOf(value);
  // `value` often starts as the "+90" placeholder and is replaced by a real
  // loaded number a moment later (once the parent's async fetch resolves) —
  // seeding this from `value` only once at mount (a plain useState
  // initializer) would freeze the tab on whatever "+90" derives to
  // (Landline) and never notice a mobile number arriving afterward. Instead,
  // the kind is derived fresh from `value` on every render, and only
  // overridden once the user actually clicks a tab themselves.
  const [kindOverride, setKindOverride] = useState<PhoneKind | null>(null);
  const kind: PhoneKind = kindOverride ?? (digits[0] === "5" ? "MOBILE" : "LANDLINE");

  const suggestedCodes = areaCodesForProvince(suggestedProvince) ?? [];
  const areaCodeOptions: DropdownOption[] = (suggestedCodes.length > 0 ? suggestedCodes : ALL_TURKEY_AREA_CODES).map(
    (code) => ({ value: code, label: `0${code}` }),
  );

  const areaCode = kind === "LANDLINE" ? digits.slice(0, 3) : "";
  const localDigits = kind === "LANDLINE" ? digits.slice(3, 10) : "";

  // The moment a suggested province resolves and no area code has been
  // picked yet, default the dropdown to its first code — still fully
  // overridable below (e.g. a headquarters line registered in another city).
  useEffect(() => {
    if (kind === "LANDLINE" && !areaCode && suggestedCodes.length > 0) {
      onChange(`+90${suggestedCodes[0]}`);
    }
    // Only re-run when the suggestion itself changes or the mode switches to
    // Landline — not on every keystroke of the local-number field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, suggestedProvince]);

  function switchKind(next: PhoneKind) {
    setKindOverride(next);
    onChange("+90");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => switchKind("LANDLINE")} className={pillClass(kind === "LANDLINE")}>
          Landline
        </button>
        <button type="button" onClick={() => switchKind("MOBILE")} className={pillClass(kind === "MOBILE")}>
          Mobile
        </button>
      </div>

      {kind === "LANDLINE" ? (
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <SingleSelectDropdown
              value={areaCode || null}
              options={areaCodeOptions}
              placeholder="Area code"
              searchable={areaCodeOptions.length > 8}
              clearable={false}
              onChange={(code) => code && onChange(`+90${code}${localDigits}`)}
            />
          </div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="XXX XX XX"
            value={localDigits}
            onChange={(e) => onChange(`+90${areaCode}${e.target.value.replace(/\D/g, "").slice(0, 7)}`)}
            disabled={!areaCode}
            className="flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : (
        <PhoneNumberInput value={value} onChange={onChange} />
      )}
    </div>
  );
}

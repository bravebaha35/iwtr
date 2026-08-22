"use client";

import { useState } from "react";
import { COUNTRIES, findCountryByCode } from "@/lib/countries";
import { formatGroupedDigits } from "@/lib/phoneFormat";

/**
 * E.164 phone entry: a flag + dial-code button (opens a searchable country
 * popup) next to a plain digits field. `value`/`onChange` stay in the same
 * "+905551234567" shape the API already expects.
 */
export function PhoneNumberInput({
  value,
  onChange,
  defaultCountryCode = "TR",
  groupSizes,
}: {
  value: string;
  onChange: (value: string) => void;
  defaultCountryCode?: string;
  // Optional visual digit grouping (e.g. [3,3,2,2] -> "555-123-45-67") for a
  // caller that knows its numbers are a fixed shape (e.g. Turkish mobile).
  // Purely presentational — onChange still reports plain digits. Omitted by
  // every other caller, which keeps their plain unformatted digits box
  // unchanged (a number's shape varies too much across countries to format
  // by default here).
  groupSizes?: number[];
}) {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const country = findCountryByCode(countryCode) ?? COUNTRIES[0];
  const numberPart = value.startsWith(country.dialCode) ? value.slice(country.dialCode.length) : "";

  function pickCountry(code: string) {
    const c = findCountryByCode(code);
    if (!c) return;
    setCountryCode(code);
    onChange(`${c.dialCode}${numberPart}`);
    setOpen(false);
    setQuery("");
  }

  function setDigits(digits: string) {
    onChange(`${country.dialCode}${digits}`);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(normalizedQuery) || c.dialCode.includes(normalizedQuery))
    : COUNTRIES;

  return (
    <div className="relative flex gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-sm text-foreground"
      >
        <span>{country.flag}</span>
        <span>{country.dialCode}</span>
      </button>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="5XX XXX XX XX"
        value={groupSizes ? formatGroupedDigits(numberPart, groupSizes) : numberPart}
        onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
        className="flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
      />

      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[70] mt-1 w-80 rounded-lg border border-border bg-surface p-2 shadow-xl">
            <input
              type="search"
              autoFocus
              placeholder="Search country or code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-1.5 w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground"
            />
            <div className="no-scrollbar flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCountry(c.code)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-foreground hover:bg-surface-muted"
                >
                  <span className="shrink-0">{c.flag}</span>
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{c.name}</span>
                  <span className="shrink-0 text-muted-foreground">{c.dialCode}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";
import { SingleSelectDropdown } from "@/components/Dropdown";

export interface LocationValue {
  country: string | null;
  city: string | null;
  district: string | null;
}

// Real vector flag icons (flag-icons package, imported globally in
// layout.tsx) rather than Unicode flag emoji — Windows renders unsupported
// flag-emoji sequences as their boxed two-letter fallback (e.g. "TR"), so
// emoji alone can't be relied on across platforms. Same approach as
// CityDistrictPicker's country dropdown.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code.toLowerCase()} shrink-0 rounded-[2px]`} aria-hidden />,
}));

/**
 * Three side-by-side dropdowns — Country, City, District — rather than a
 * single summary box that opened a full popup. City is disabled until a
 * country is picked, District until a city is picked. Only Turkey has real
 * city/district data (lib/turkeyGeo.ts); every other country falls back to
 * free-text city/district entry, since no such dataset exists for them.
 */
export function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (value: LocationValue) => void }) {
  const isTurkey = value.country === "Turkey";
  const province = isTurkey ? findProvinceByCityName(value.city) : null;

  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = (province?.districts ?? []).map((d) => ({ value: d, label: d }));

  // Bumped to force the next dropdown open right after the previous one is
  // picked (Country -> City -> District) — see SingleSelectDropdown's
  // `openSignal`. The "just picked" refs make sure that only fires off a
  // real, interactive selection, never on initial load with an
  // already-filled-in location (which would otherwise yank focus into the
  // city/district field the moment the profile page renders).
  const [cityOpenSignal, setCityOpenSignal] = useState(0);
  const [districtOpenSignal, setDistrictOpenSignal] = useState(0);
  const justPickedCountry = useRef(false);
  const justPickedCity = useRef(false);

  useEffect(() => {
    if (!justPickedCountry.current) return;
    justPickedCountry.current = false;
    // Only the Turkey path re-renders City as a dropdown — the free-text
    // fallback for other countries has nothing to "open".
    if (isTurkey) setCityOpenSignal((n) => n + 1);
  }, [value.country, isTurkey]);

  useEffect(() => {
    if (!justPickedCity.current) return;
    justPickedCity.current = false;
    if (isTurkey) setDistrictOpenSignal((n) => n + 1);
  }, [value.city, isTurkey]);

  return (
    <div className="grid grid-cols-3 gap-2">
      <SingleSelectDropdown
        value={value.country}
        options={COUNTRY_OPTIONS}
        placeholder="Country"
        onChange={(country) => {
          justPickedCountry.current = true;
          onChange({ country, city: null, district: null });
        }}
      />

      {value.country && !isTurkey ? (
        <input
          placeholder="City"
          value={value.city ?? ""}
          onChange={(e) => onChange({ ...value, city: e.target.value || null, district: null })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
        />
      ) : (
        <SingleSelectDropdown
          value={value.city}
          options={cityOptions}
          placeholder="City"
          disabled={!value.country}
          openSignal={cityOpenSignal}
          onChange={(city) => {
            justPickedCity.current = true;
            onChange({ ...value, city, district: null });
          }}
        />
      )}

      {value.city && !isTurkey ? (
        <input
          placeholder="District (optional)"
          value={value.district ?? ""}
          onChange={(e) => onChange({ ...value, district: e.target.value || null })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
        />
      ) : (
        <SingleSelectDropdown
          value={value.district}
          options={districtOptions}
          placeholder="District"
          disabled={!value.city}
          openSignal={districtOpenSignal}
          onChange={(district) => onChange({ ...value, district })}
        />
      )}
    </div>
  );
}

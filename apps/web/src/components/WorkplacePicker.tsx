"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyListItem } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { COUNTRIES } from "@/lib/countries";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";
import { SingleSelectDropdown } from "@/components/Dropdown";

function optionClass(active: boolean): string {
  return `w-full rounded px-2 py-1.5 text-left text-sm transition ${
    active ? "bg-brand-600 text-white" : "text-foreground hover:bg-surface-muted"
  }`;
}

// Real vector flag icons (flag-icons package, imported globally in
// layout.tsx) rather than Unicode flag emoji — same reasoning as
// LocationPicker/CityDistrictPicker's country dropdowns.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code.toLowerCase()} shrink-0 rounded-[2px]`} aria-hidden />,
}));
const DEFAULT_COUNTRY = "Turkey";

/**
 * "Which country/city/district is this workplace in, then find its name."
 * Country/city/district are three side-by-side dropdowns — the same pattern
 * as LocationPicker (personal location on the /me page) — rather than the
 * old summary-box-that-opens-a-popup design, so both "where do you live" and
 * "where did you work" pickers now look and behave the same. Company list
 * comes from the real database (the same one the browse page uses); as more
 * workplaces get added there, more show up here automatically.
 *
 * Suggestions only appear once BOTH city and district are picked, not as
 * soon as city is — a big city can carry hundreds of seeded companies, and
 * showing that whole pile before district narrows it down defeats the point
 * of having a district step at all.
 *
 * `allowFreeText` (off by default) adds a "can't find it? use this name"
 * fallback below the results — needed for onboarding, whose
 * `POST /onboarding/history` accepts a free-typed `rawCompanyName` with a
 * null `companyId` and backfills the link later once/if a matching Company
 * is seeded (see onboarding.service.ts's submitHistory). Without this, a
 * user whose employer isn't in the (currently small) seeded company list
 * could never get past onboarding at all. The post-onboarding
 * account-settings "add workplace" flow (`POST /me/employment-history`)
 * deliberately does NOT allow this — it always requires a real picked
 * Company row — so it leaves `allowFreeText` at its default.
 */
export function WorkplacePicker({
  onPick,
  allowFreeText = false,
}: {
  onPick: (workplace: { companyId: string | null; name: string; slug: string | null }) => void;
  allowFreeText?: boolean;
}) {
  // Defaults to Turkey rather than unset — nearly every seeded company is a
  // Turkish business today (see lib/turkeyGeo.ts), so defaulting here avoids
  // an extra click on the common path while still leaving the dropdown open
  // for whenever another country gets real data.
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  // Distinguishes "the workplace list failed to load" from "loaded fine,
  // this city/district just has none yet" — both previously rendered the
  // same "No workplaces here yet" message.
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");

  const isTurkey = country === DEFAULT_COUNTRY;
  const province = isTurkey ? findProvinceByCityName(city) : null;
  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = (province?.districts ?? []).map((d) => ({ value: d, label: d }));

  useEffect(() => {
    apiGet<CompanyListItem[]>("/companies")
      .then(setCompanies)
      .catch(() => {
        setCompanies([]);
        setLoadFailed(true);
      });
  }, []);

  const filtered = useMemo(() => {
    // Requires district too, not just city — a big city like Istanbul can
    // carry hundreds of seeded companies, and dumping all of them in as soon
    // as the city is picked (before district narrows it down) is exactly the
    // wall-of-results the district step exists to avoid.
    if (!companies || !city || !district) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return companies.filter((c) => {
      const companyCityName = findProvinceByCityName(c.city)?.name ?? c.city;
      if (companyCityName !== city) return false;
      if (c.district !== district) return false;
      if (normalizedQuery && !c.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) return false;
      return true;
    });
  }, [companies, city, district, query]);

  function pickCountry(next: string | null) {
    setCountry(next ?? DEFAULT_COUNTRY);
    setCity(null);
    setDistrict(null);
  }

  function pickCity(next: string | null) {
    setCity(next);
    setDistrict(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Workplace&apos;s country, city &amp; district</p>
        <div className="grid grid-cols-3 gap-2">
          <SingleSelectDropdown value={country} options={COUNTRY_OPTIONS} placeholder="Country" onChange={pickCountry} />

          {!isTurkey ? (
            <input
              placeholder="City"
              value={city ?? ""}
              onChange={(e) => pickCity(e.target.value || null)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
            />
          ) : (
            <SingleSelectDropdown value={city} options={cityOptions} placeholder="City" onChange={pickCity} />
          )}

          {city && !isTurkey ? (
            <input
              placeholder="District (optional)"
              value={district ?? ""}
              onChange={(e) => setDistrict(e.target.value || null)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
            />
          ) : (
            <SingleSelectDropdown
              value={district}
              options={districtOptions}
              placeholder="District"
              disabled={!city}
              onChange={setDistrict}
            />
          )}
        </div>
        {!isTurkey && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Workplace data for {country} isn&apos;t available yet — Turkey is the only country covered so far.
          </p>
        )}
      </div>

      {city && !district && (
        <p className="text-xs text-muted-foreground/60">Choose a district to see workplaces here.</p>
      )}

      {city && district && (
        <>
          <input
            type="search"
            placeholder="Search workplace name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
          />
          <div className="no-scrollbar flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
            {companies === null && <p className="p-2 text-xs text-muted-foreground">Loading...</p>}
            {companies !== null && filtered.length === 0 && loadFailed && (
              <p className="p-2 text-xs text-red-600 dark:text-red-400">Couldn&apos;t load workplaces — try again.</p>
            )}
            {companies !== null && filtered.length === 0 && !loadFailed && (
              <p className="p-2 text-xs text-muted-foreground">No workplaces here yet.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick({ companyId: c.id, name: c.name, slug: c.slug })}
                className={optionClass(false)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {allowFreeText && query.trim() && (
            <button
              type="button"
              onClick={() => onPick({ companyId: null, name: query.trim(), slug: null })}
              className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-muted"
            >
              Can&apos;t find it? Use &ldquo;{query.trim()}&rdquo; as your workplace name
            </button>
          )}
        </>
      )}
    </div>
  );
}

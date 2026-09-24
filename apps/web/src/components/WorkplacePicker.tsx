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
const MAX_RESULTS = 50;

/**
 * "Search for the workplace by name" (nationwide, always available), with
 * "browse by country/city/district" as a fallback for anyone who doesn't
 * know how it's spelled — not the other way around. Company list comes from
 * the real database (the same one the browse page uses); as more workplaces
 * get added there, more show up here automatically.
 *
 * Search results are nationwide the moment 2+ characters are typed —
 * location is NOT a prerequisite (previously it was: city and district both
 * had to be picked before the search box even appeared, which meant filling
 * out two dropdowns just to reach a text field). Once a real company is
 * picked, its own country/city/district back-fills the location fields
 * below automatically, so a user who already knows their employer's name
 * never has to touch those dropdowns at all. Typing a query and browsing by
 * location are two separate modes, not combined — a typed query always
 * searches nationwide (ignoring whatever city/district happen to be set),
 * so switching to a different pick never gets silently filtered out by a
 * leftover district from an earlier one; clearing the query goes back to
 * pure city+district browsing.
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
 * Company row — so it leaves `allowFreeText` at its default. Free-typing
 * still needs a location, since there's no picked Company row to back-fill
 * one from — the country/city/district dropdowns stay fully editable for
 * exactly that case.
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
  // nothing matches yet" — both previously rendered the same "No workplaces
  // here yet" message.
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

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const hasQuery = normalizedQuery.length >= 2;
  const isBrowsingByLocation = !hasQuery && Boolean(city && district);

  const filtered = useMemo(() => {
    if (!companies) return [];
    if (hasQuery) {
      return companies.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery));
    }
    if (city && district) {
      return companies.filter((c) => {
        const companyCityName = findProvinceByCityName(c.city)?.name ?? c.city;
        return companyCityName === city && c.district === district;
      });
    }
    return [];
  }, [companies, city, district, hasQuery, normalizedQuery]);

  function resolveCompanyLocation(c: CompanyListItem): { city: string | null; district: string | null } {
    const resolvedCity = c.city ? (findProvinceByCityName(c.city)?.name ?? c.city) : null;
    return { city: resolvedCity, district: c.district ?? null };
  }

  function pick(c: CompanyListItem) {
    const location = resolveCompanyLocation(c);
    setCountry(DEFAULT_COUNTRY);
    setCity(location.city);
    setDistrict(location.district);
    onPick({ companyId: c.id, name: c.name, slug: c.slug });
  }

  function pickCountry(next: string | null) {
    setCountry(next ?? DEFAULT_COUNTRY);
    setCity(null);
    setDistrict(null);
  }

  function pickCity(next: string | null) {
    setCity(next);
    setDistrict(null);
  }

  const showResultsPanel = hasQuery || isBrowsingByLocation;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Search workplace name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
      />

      {showResultsPanel && (
        <div className="no-scrollbar flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {companies === null && <p className="p-2 text-xs text-muted-foreground">Loading...</p>}
          {companies !== null && filtered.length === 0 && loadFailed && (
            <p className="p-2 text-xs text-red-600 dark:text-red-400">Couldn&apos;t load workplaces — try again.</p>
          )}
          {companies !== null && filtered.length === 0 && !loadFailed && (
            <p className="p-2 text-xs text-muted-foreground">No workplaces found.</p>
          )}
          {filtered.slice(0, MAX_RESULTS).map((c) => {
            const location = resolveCompanyLocation(c);
            return (
              <button key={c.id} type="button" onClick={() => pick(c)} className={optionClass(false)}>
                {c.name}
                {location.city && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    — {location.city}
                    {location.district ? `, ${location.district}` : ""}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length > MAX_RESULTS && (
            <p className="p-2 text-xs text-muted-foreground">
              {filtered.length - MAX_RESULTS} more match — keep typing to narrow it down.
            </p>
          )}
        </div>
      )}
      {!hasQuery && query.trim() && (
        <p className="text-xs text-muted-foreground/60">Keep typing (2+ characters) to search.</p>
      )}

      {allowFreeText && query.trim() && (
        <button
          type="button"
          onClick={() => onPick({ companyId: null, name: query.trim(), slug: null })}
          className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-muted"
        >
          Can&apos;t find it? Use &ldquo;{query.trim()}&rdquo; as your workplace name
        </button>
      )}

      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Workplace&apos;s country, city &amp; district
          <span className="font-normal text-muted-foreground/70"> — fills in automatically once you pick a workplace above</span>
        </p>
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
        {allowFreeText && (
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            Using a free-typed name? Set these yourself — there&apos;s no matched company to fill them in from.
          </p>
        )}
      </div>
    </div>
  );
}

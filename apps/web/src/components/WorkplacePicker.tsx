"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyListItem } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";

function optionClass(active: boolean): string {
  return `w-full rounded px-2 py-1.5 text-left text-sm transition ${
    active ? "bg-brand-600 text-white" : "text-foreground hover:bg-surface-muted"
  }`;
}

/**
 * "Which city/district is this workplace in, then find its name" — never a
 * free-text company name field. City/district picking lives behind a summary
 * box + "Choose" button that opens a popup (same pattern as LocationPicker),
 * not two always-open lists sitting inline — that ate a lot of vertical space
 * and, worse, is exactly where the Add-workplace flow used to show cut-off
 * district names. Company list comes from the real database (the same one
 * the browse page uses); as more workplaces get added there, more show up
 * here automatically.
 */
export function WorkplacePicker({
  onPick,
}: {
  onPick: (company: Pick<CompanyListItem, "id" | "name" | "slug">) => void;
}) {
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");

  useEffect(() => {
    apiGet<CompanyListItem[]>("/companies")
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  const filtered = useMemo(() => {
    if (!companies || !city) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return companies.filter((c) => {
      const province = findProvinceByCityName(c.city);
      const cityName = province?.name ?? c.city;
      if (cityName !== city) return false;
      if (district && c.district !== district) return false;
      if (normalizedQuery && !c.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery)) return false;
      return true;
    });
  }, [companies, city, district, query]);

  const province = findProvinceByCityName(city);
  const summary = [city, district].filter(Boolean).join(", ") || "Not set";

  const cityNormalizedQuery = cityQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredCities = cityNormalizedQuery
    ? TURKEY_PROVINCES.filter((p) => p.name.toLocaleLowerCase("tr-TR").includes(cityNormalizedQuery))
    : TURKEY_PROVINCES;

  const districts = province?.districts ?? [];
  const districtNormalizedQuery = districtQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredDistricts = districtNormalizedQuery
    ? districts.filter((d) => d.toLocaleLowerCase("tr-TR").includes(districtNormalizedQuery))
    : districts;

  function pickCity(name: string) {
    setCity(name);
    setDistrict(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Workplace&apos;s city &amp; district</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={summary}
            onClick={() => setOpen(true)}
            className="flex-1 cursor-pointer truncate rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Choose
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">City &amp; district</h3>

            <p className="mb-1 text-xs font-medium text-muted-foreground">City</p>
            <input
              type="search"
              placeholder="Search city..."
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              className="mb-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
            />
            <div className="no-scrollbar mb-4 flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {filteredCities.map((p) => (
                <button key={p.plate} type="button" onClick={() => pickCity(p.name)} className={optionClass(city === p.name)}>
                  {p.name}
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs font-medium text-muted-foreground">District</p>
            {!city ? (
              <p className="mb-4 text-xs text-muted-foreground/60">Choose a city first.</p>
            ) : (
              <>
                <input
                  type="search"
                  placeholder="Search district..."
                  value={districtQuery}
                  onChange={(e) => setDistrictQuery(e.target.value)}
                  className="mb-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
                />
                <div className="no-scrollbar mb-4 flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
                  {filteredDistricts.map((d) => (
                    <button key={d} type="button" onClick={() => setDistrict(d)} className={optionClass(district === d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {city && (
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
            {companies !== null && filtered.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">No workplaces here yet.</p>
            )}
            {filtered.map((c) => (
              <button key={c.id} type="button" onClick={() => onPick(c)} className={optionClass(false)}>
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

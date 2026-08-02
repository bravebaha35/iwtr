"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";

function optionClass(active: boolean): string {
  return `w-full rounded px-2 py-1.5 text-left text-sm transition ${
    active ? "bg-brand-600 text-white" : "text-foreground hover:bg-surface-muted"
  }`;
}

export interface LocationValue {
  country: string | null;
  city: string | null;
  district: string | null;
}

/**
 * Country -> City -> District as one popup, opened from a summary text box +
 * button next to it — not three inline boxes stacked on the page. Each level
 * is greyed out/disabled until its prerequisite is chosen. Only Turkey has
 * real city/district data (lib/turkeyGeo.ts); every other country falls back
 * to free-text city/district entry, since no such dataset exists for them.
 */
export function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (value: LocationValue) => void }) {
  const [open, setOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");

  const isTurkey = value.country === "Turkey";
  const province = isTurkey ? findProvinceByCityName(value.city) : null;
  const summary = [value.country, value.city, value.district].filter(Boolean).join(", ") || "Not set";

  const filteredCountries = countryQuery.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(countryQuery.trim().toLowerCase()))
    : COUNTRIES;

  const cityNormalizedQuery = cityQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredCities = cityNormalizedQuery
    ? TURKEY_PROVINCES.filter((p) => p.name.toLocaleLowerCase("tr-TR").includes(cityNormalizedQuery))
    : TURKEY_PROVINCES;

  const districts = province?.districts ?? [];
  const districtNormalizedQuery = districtQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredDistricts = districtNormalizedQuery
    ? districts.filter((d) => d.toLocaleLowerCase("tr-TR").includes(districtNormalizedQuery))
    : districts;

  function pickCountry(name: string) {
    onChange({ country: name, city: null, district: null });
  }
  function pickCity(city: string) {
    onChange({ ...value, city, district: null });
  }
  function pickDistrict(district: string) {
    onChange({ ...value, district });
  }

  return (
    <div>
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

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-foreground">Country, city &amp; district</h3>

            <p className="mb-1 text-xs font-medium text-muted-foreground">Country</p>
            <input
              type="search"
              placeholder="Search country..."
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              className="mb-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
            />
            <div className="no-scrollbar mb-4 flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {filteredCountries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCountry(c.name)}
                  className={`${optionClass(value.country === c.name)} flex items-center gap-2`}
                >
                  <span className="shrink-0">{c.flag}</span>
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{c.name}</span>
                </button>
              ))}
            </div>

            <p className="mb-1 text-xs font-medium text-muted-foreground">City</p>
            {!value.country ? (
              <p className="mb-4 text-xs text-muted-foreground/60">Choose a country first.</p>
            ) : isTurkey ? (
              <>
                <input
                  type="search"
                  placeholder="Search city..."
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  className="mb-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
                />
                <div className="no-scrollbar mb-4 flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
                  {filteredCities.map((p) => (
                    <button
                      key={p.plate}
                      type="button"
                      onClick={() => pickCity(p.name)}
                      className={optionClass(value.city === p.name)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <input
                placeholder="City"
                value={value.city ?? ""}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
                className="mb-4 w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
            )}

            <p className="mb-1 text-xs font-medium text-muted-foreground">District</p>
            {!value.city ? (
              <p className="mb-4 text-xs text-muted-foreground/60">Choose a city first.</p>
            ) : isTurkey ? (
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
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDistrict(d)}
                      className={optionClass(value.district === d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <input
                placeholder="District (optional)"
                value={value.district ?? ""}
                onChange={(e) => onChange({ ...value, district: e.target.value })}
                className="mb-4 w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
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
    </div>
  );
}

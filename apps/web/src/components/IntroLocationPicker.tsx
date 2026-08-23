"use client";

import { useState } from "react";
import { TURKEY_PROVINCES } from "@/lib/turkeyGeo";
import { COUNTRIES } from "@/lib/countries";
import { SingleSelectDropdown, MultiSelectDropdown } from "@/components/Dropdown";
import { districtKey } from "@/components/CityDistrictPicker";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code.toLowerCase()} shrink-0 rounded-[2px]`} aria-hidden />,
}));
const DEFAULT_COUNTRY = "Turkey";

/**
 * Location preview for the landing-page hero — a City dropdown (single
 * select) and a District dropdown (multi-select, cascading from the chosen
 * city), both closed by default. This is a deliberately different UI from
 * the real filter sidebar's CityDistrictPicker (an always-visible expandable
 * province/district list) — the hero wants a compact, closed-by-default
 * pair of dropdowns instead, and has no "Clear location filter" affordance
 * since this is just a preview widget, not a persistent filter.
 */
export function IntroLocationPicker({
  selectedCities,
  selectedDistrictKeys,
  onToggleCity,
  onToggleDistrict,
  onNearMe,
  nearMeLoading,
  nearMeActive,
}: {
  selectedCities: string[];
  selectedDistrictKeys: string[];
  onToggleCity: (province: string) => void;
  onToggleDistrict: (key: string) => void;
  onNearMe: () => void;
  nearMeLoading: boolean;
  nearMeActive: boolean;
}) {
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const isTurkey = country === DEFAULT_COUNTRY;

  const selectedCity = selectedCities[0] ?? null;
  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = selectedCity
    ? (TURKEY_PROVINCES.find((p) => p.name === selectedCity)?.districts ?? []).map((d) => ({
        value: districtKey(selectedCity, d),
        label: d,
      }))
    : [];

  function handleCityChange(next: string | null) {
    // Any districts already picked belonged to the city being replaced (or
    // cleared) — drop them rather than leaving them silently applied to a
    // city the picker no longer shows as selectable.
    selectedDistrictKeys.forEach((key) => onToggleDistrict(key));
    if (next !== null) onToggleCity(next);
    else if (selectedCity !== null) onToggleCity(selectedCity);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
        <button
          type="button"
          onClick={onNearMe}
          disabled={nearMeLoading}
          title="Sort results by distance from you — doesn't change which cities are selected"
          className={`text-xs font-medium disabled:opacity-50 ${
            nearMeActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:underline"
          }`}
        >
          {nearMeLoading ? "Locating…" : "Near Me"}
        </button>
      </div>
      <div className="mb-2">
        <SingleSelectDropdown
          value={country}
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
          onChange={(next) => setCountry(next ?? DEFAULT_COUNTRY)}
        />
      </div>
      {!isTurkey ? (
        <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
          City/district data for {country} isn&apos;t available yet — Turkey is the only country covered so far.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">City</p>
            <SingleSelectDropdown
              value={selectedCity}
              options={cityOptions}
              placeholder="Select city"
              onChange={handleCityChange}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">District</p>
            <MultiSelectDropdown
              values={selectedDistrictKeys}
              options={districtOptions}
              placeholder={selectedCity ? "Select districts" : "Select a city first"}
              onToggle={onToggleDistrict}
              disabled={!selectedCity}
            />
          </div>
        </div>
      )}
    </div>
  );
}

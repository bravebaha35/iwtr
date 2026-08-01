"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { scoreBandLabel, type CompanyFilters, type CompanyListItem, type WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";
import { FilterPillGroup } from "@/components/FilterPillGroup";

function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${company.slug}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {company.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{company.name}</p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {workplaceTypeLabel(company.workplaceType)} · {company.category}
            {company.city ? ` · ${company.city}` : ""}
          </p>
        </div>
      </div>

      {company.overallAvg !== null ? (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {company.overallAvg.toFixed(1)}
          </span>
          <span className={`text-xs font-medium ${scoreTextColor(company.overallAvg)}`}>
            {scoreBandLabel(company.overallAvg)}
          </span>
          <span className="text-xs text-zinc-400">
            ({company.reviewCount} review{company.reviewCount === 1 ? "" : "s"})
          </span>
        </div>
      ) : (
        <p className="text-xs text-zinc-400">No reviews yet</p>
      )}
    </Link>
  );
}

export function WorkplaceBrowser({ defaultCity }: { defaultCity: string | null }) {
  const [filters, setFilters] = useState<CompanyFilters | null>(null);
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType | null>(null);
  const [city, setCity] = useState<string | null>(defaultCity);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);

  useEffect(() => {
    apiGet<CompanyFilters>("/companies/filters")
      .then(setFilters)
      .catch(() => setFilters({ cities: [] }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (workplaceType) params.set("workplaceType", workplaceType);
    if (city) params.set("city", city);

    let cancelled = false;
    const handle = setTimeout(() => {
      apiGet<CompanyListItem[]>(`/companies?${params.toString()}`)
        .then((data) => {
          if (!cancelled) setCompanies(data);
        })
        .catch(() => {
          if (!cancelled) setCompanies([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, workplaceType, city]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Location bar — the top-level filter axis, mirroring how a
          delivery-style browse page leads with "where", before "what".
          Explicit pill buttons (not a native <select>) so the currently
          active choice, including "All cities", is always visibly obvious. */}
      <div className="mb-6">
        <FilterPillGroup
          heading="Showing workplaces in"
          allLabel="All cities"
          options={(filters?.cities ?? []).map((c) => ({ value: c, label: c }))}
          selected={city}
          onSelect={setCity}
          direction="wrap"
        />
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <aside className="shrink-0 sm:w-48">
          <FilterPillGroup
            heading="Workplace type"
            allLabel="All types"
            options={WORKPLACE_TYPES}
            selected={workplaceType}
            onSelect={setWorkplaceType}
            direction="column"
          />
        </aside>

        {/* Results */}
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search a workplace by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4 w-full rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {companies === null && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}
          {companies !== null && companies.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No workplaces match these filters yet.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies?.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Company } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

export function CompanySearch({ size = "sm" }: { size?: "sm" | "lg" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      apiGet<Company[]>(`/companies?q=${encodeURIComponent(query)}`)
        .then((data) => {
          // A faster-typed later query's response can still resolve after
          // this one if requests arrive out of order — ignore this result if
          // a newer query has since superseded it.
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const isLarge = size === "lg";

  return (
    <div className={`relative ${isLarge ? "w-full" : "w-64"}`}>
      <input
        type="search"
        placeholder="Search a workplace..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={
          isLarge
            ? "w-full rounded-full border border-zinc-300 px-6 py-3.5 text-base shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            : "w-full rounded-full border border-zinc-300 px-4 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        }
      />
      {open && results.length > 0 && (
        <div
          className={`absolute z-10 mt-1 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${
            isLarge ? "left-0 right-0" : "right-0 w-72"
          }`}
        >
          {results.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.slug}`}
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {c.name}
              <span className="ml-2 text-xs text-zinc-400">{c.category}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

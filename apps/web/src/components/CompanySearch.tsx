"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Company } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

export function CompanySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      apiGet<Company[]>(`/companies?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative w-64">
      <input
        type="search"
        placeholder="Search a workplace..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-full border border-zinc-300 px-4 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {open && results.length > 0 && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
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

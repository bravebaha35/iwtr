"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HOME_FILTERS_STORAGE_KEY, keepsHomeFilters } from "@/lib/homeFilters";

/** Mounted once in layout.tsx: forgets the homepage's filters as soon as the visitor moves to another page. */
export function HomeFiltersReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (keepsHomeFilters(pathname)) return;
    try {
      window.sessionStorage.removeItem(HOME_FILTERS_STORAGE_KEY);
    } catch {
      // Storage can be blocked; there is then nothing remembered to clear.
    }
  }, [pathname]);
  return null;
}

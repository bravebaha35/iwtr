import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

// Regenerated at most once an hour.
export const revalidate = 3600;

const STATIC_PAGES: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/jobs", changeFrequency: "daily", priority: 0.9 },
  { path: "/social", changeFrequency: "daily", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
];

/**
 * sitemap.xml: the public pages plus every visible company page (job
 * postings live on /jobs and on each company page). If the API can't be
 * reached, the static pages are still served rather than an error.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  try {
    const res = await fetch(`${API_BASE_URL}/companies/sitemap`, { next: { revalidate } });
    if (res.ok) {
      const companies = (await res.json()) as { slug: string; lastModified: string | null }[];
      for (const c of companies) {
        entries.push({
          url: `${SITE_URL}/companies/${encodeURIComponent(c.slug)}`,
          lastModified: c.lastModified ?? undefined,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // API unreachable: static pages only.
  }
  return entries;
}

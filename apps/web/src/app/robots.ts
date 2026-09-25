import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Public pages (companies, jobs, IWT Social, legal) are indexable; account,
// owner-dashboard and admin pages and every API/proxy route are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/companies/", "/jobs", "/social", "/privacy", "/terms"],
      disallow: ["/api/", "/admin", "/me", "/my/", "/onboarding", "/*?*tab=messages"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

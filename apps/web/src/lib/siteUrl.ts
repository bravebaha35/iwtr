// The public origin used in absolute URLs (sitemap, robots, Open Graph).
// Set NEXT_PUBLIC_SITE_URL per environment; production defaults to the
// real domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://iworkedthere.com").replace(/\/$/, "");

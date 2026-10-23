// The site's full-page error screens and the picture each one shows.
//
// There are three, one per way a page can fail:
//   notFound  - the address leads nowhere (404, app/not-found.tsx)
//   crash     - a page broke while loading or showing (app/error.tsx); the
//               header and footer stay, only the page area is replaced
//   siteDown  - the whole site failed to start in the browser
//               (app/global-error.tsx); nothing else of the site is shown
//
// A screen whose picture is null shows a soft empty panel in its place, so
// the layout is already final. To add a picture: put the file in
// apps/web/public/ and write its path and pixel size here
// (e.g. { src: "/error-crash.png", width: 1200, height: 1600 }).
export const ERROR_SCREEN_ART: Record<"notFound" | "crash" | "siteDown", { src: string; width: number; height: number } | null> = {
  notFound: { src: "/dusunenkunduz.png", width: 2748, height: 4096 },
  crash: null,
  siteDown: null,
};

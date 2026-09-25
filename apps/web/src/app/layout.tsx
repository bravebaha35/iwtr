import type { Metadata } from "next";
import { DM_Serif_Display, Google_Sans_Flex } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { BackButton } from "@/components/BackButton";
import { GlobalHeader } from "@/components/GlobalHeader";
import { GlobalFooter } from "@/components/GlobalFooter";
import { AuthModal } from "@/components/auth/AuthModal";
import { MagneticPrimaryButtons } from "@/components/motion/MagneticPrimaryButtons";
import { CookieConsentBanner } from "@/components/privacy/CookieConsentBanner";
import { AnalyticsLoader } from "@/components/privacy/AnalyticsLoader";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";
// Real vector flag icons (not Unicode flag emoji) — Windows renders
// unsupported flag-emoji regional-indicator pairs as a boxed two-letter
// fallback (e.g. "TR" instead of a Turkish flag), so emoji alone can't be
// relied on for country flags across platforms. Used by CityDistrictPicker's
// country picker.
import "flag-icons/css/flag-icons.min.css";

// Applies the saved theme (and marks an existing cookie choice, so the
// server-rendered cookie bar stays hidden) before first paint, so there's no flash of the
// wrong theme on load — mirrors the logic in lib/settings-context.tsx.
// Wrapped in try/catch since localStorage/matchMedia can throw in some
// privacy-locked-down browsers, and a theme glitch shouldn't break the app.
const THEME_BOOT_SCRIPT = `(function(){
  try {
    var theme = localStorage.getItem('iwtr:theme');
    var isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    var consent = localStorage.getItem('iwtr:cookie-consent');
    if (consent === 'accepted' || consent === 'declined') document.documentElement.setAttribute('data-cookie-consent', consent);
  } catch (e) {}
})();`;

// Body and UI text: Google Sans Flex (variable, with its roundness axis —
// globals.css sets it part-way up for friendlier letterforms). Headings: DM
// Serif Display. "latin-ext" is mandatory for both: Turkish letters
// (İ/ı/Ş/ş/Ğ/ğ/Ç/ç/Ö/ö/Ü/ü) live in Latin Extended-A, not base Latin.
const googleSansFlex = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  subsets: ["latin", "latin-ext"],
  axes: ["ROND"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Anonymous, honest workplace reviews from people who actually worked there. No names. No HR. Rate your past employers and check a company before you accept a job.";

// Site-wide defaults; pages override title/description (company pages build
// theirs from the company's name and score). The social preview image is
// app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "I Worked There — anonymous workplace reviews", template: "%s · I Worked There" },
  description: SITE_DESCRIPTION,
  applicationName: "I Worked There",
  openGraph: {
    type: "website",
    siteName: "I Worked There",
    title: "I Worked There — anonymous workplace reviews",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    alternateLocale: ["tr_TR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "I Worked There — anonymous workplace reviews",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The font variables are applied on <body> below too, but must ALSO be
      // here: globals.css's `@theme inline` declares `--font-sans:
      // var(--font-google-sans-flex)` at :root, and a custom-property
      // reference resolves at the element declaring it. Since :root IS
      // <html>, without them here --font-sans resolves to nothing and every
      // font-sans rule silently falls back to the browser default.
      className={`${googleSansFlex.variable} ${dmSerifDisplay.variable} h-full antialiased`}
      // The boot script below sets `.dark`/`data-density` synchronously,
      // before React hydrates, so the server-rendered markup never matches —
      // that's expected (it's what avoids a flash of the wrong theme), so
      // silence the warning rather than fighting it.
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line react/no-danger -- a fixed constant defined in this file, no user content */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${googleSansFlex.variable} ${dmSerifDisplay.variable} min-h-full flex flex-col bg-background text-foreground`}
      >
        <SettingsProvider>
          <AuthProvider>
            <GlobalHeader />
            {/* The one main landmark; pages render their content inside it. At
                least a screen tall, so the footer starts below the fold and
                pages that fill in after loading never make it jump. */}
            <main id="main" className="flex min-h-[100svh] flex-1 flex-col">
              {children}
            </main>
            <BackButton />
            <AuthModal />
          </AuthProvider>
        </SettingsProvider>
        <GlobalFooter />
        <MagneticPrimaryButtons />
        <CookieConsentBanner />
        <AnalyticsLoader />
      </body>
    </html>
  );
}

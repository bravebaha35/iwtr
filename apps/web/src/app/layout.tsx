import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { BackButton } from "@/components/BackButton";
import { GlobalHeader } from "@/components/GlobalHeader";
import { GlobalFooter } from "@/components/GlobalFooter";
import { AuthModal } from "@/components/auth/AuthModal";
import { MagneticPrimaryButtons } from "@/components/motion/MagneticPrimaryButtons";
import "./globals.css";
// Real vector flag icons (not Unicode flag emoji) — Windows renders
// unsupported flag-emoji regional-indicator pairs as a boxed two-letter
// fallback (e.g. "TR" instead of a Turkish flag), so emoji alone can't be
// relied on for country flags across platforms. Used by CityDistrictPicker's
// country picker.
import "flag-icons/css/flag-icons.min.css";

// Primary typeface — chosen for brand authority plus reliable rendering of
// Turkish workplace titles (İ/ı/Ş/ş/Ğ/ğ/Ç/ç/Ö/ö/Ü/ü) and 1-5 score digits.
// "latin-ext" is mandatory here, not just "latin": Turkish-specific letters
// live in the Latin Extended-A Unicode block, not the base Latin subset.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

// CvPreview.tsx's headings use a second, distinct display face. Note this is
// NOT a second instance of Plus Jakarta Sans: the CV preview's "font-jakarta"
// Tailwind utility (see globals.css) intentionally maps back onto the single
// plusJakartaSans instance above (`--font-plus-jakarta-sans`) rather than
// loading the same Google Font twice under a second variable name, which
// would double the font payload for no benefit.
// The CSS variable is named distinctly from globals.css's Tailwind theme key
// (--font-grotesk) on purpose — matching the Jakarta font's own
// --font-plus-jakarta-sans convention above. Naming it --font-grotesk here
// too would make globals.css's `--font-grotesk: var(--font-grotesk);` a
// self-referential cycle that can silently resolve to nothing depending on
// stylesheet order, falling back to the default font with no visible error.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: "I Worked There",
  description: "Anonymous, honest workplace reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // plusJakartaSans.variable is applied on <body> below per spec, but it
      // must ALSO be present here: globals.css's `@theme inline` declares
      // `--font-sans: var(--font-plus-jakarta-sans)` at :root, and a CSS
      // custom-property reference resolves against whatever's visible AT THE
      // ELEMENT DECLARING IT — not at wherever it's later used. Since :root
      // IS <html>, --font-plus-jakarta-sans has to be defined here too, or
      // --font-sans resolves to nothing and every font-sans/body font-family
      // rule silently falls back to the browser default (verified live: this
      // exact failure happened when the variable was only on <body>).
      // Always `dark`: the Muted Industrial palette is dark-only (see
      // globals.css), so every existing dark: variant is always on and there
      // is no theme switch or pre-paint theme script any more.
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} dark h-full antialiased`}
    >
      <body
        className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} min-h-full flex flex-col bg-background text-foreground`}
      >
        <AuthProvider>
          <GlobalHeader />
          {children}
          <BackButton />
          <AuthModal />
        </AuthProvider>
        <GlobalFooter />
        <MagneticPrimaryButtons />
      </body>
    </html>
  );
}

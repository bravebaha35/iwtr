import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { BackButton } from "@/components/BackButton";
import { GlobalHeader } from "@/components/GlobalHeader";
import { AuthModal } from "@/components/auth/AuthModal";
import "./globals.css";
// Real vector flag icons (not Unicode flag emoji) — Windows renders
// unsupported flag-emoji regional-indicator pairs as a boxed two-letter
// fallback (e.g. "TR" instead of a Turkish flag), so emoji alone can't be
// relied on for country flags across platforms. Used by CityDistrictPicker's
// country picker.
import "flag-icons/css/flag-icons.min.css";

// Applies the saved theme before first paint, so there's no flash of the
// wrong theme on load — mirrors the logic in lib/settings-context.tsx.
// Wrapped in try/catch since localStorage/matchMedia can throw in some
// privacy-locked-down browsers, and a theme glitch shouldn't break the app.
const THEME_BOOT_SCRIPT = `(function(){
  try {
    var theme = localStorage.getItem('iwtr:theme');
    var isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();`;

// Primary typeface — chosen for brand authority plus reliable rendering of
// Turkish workplace titles (İ/ı/Ş/ş/Ğ/ğ/Ç/ç/Ö/ö/Ü/ü) and 1-5 score digits.
// "latin-ext" is mandatory here, not just "latin": Turkish-specific letters
// live in the Latin Extended-A Unicode block, not the base Latin subset.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistMono.variable} ${plusJakartaSans.variable} h-full antialiased`}
      // The boot script below sets `.dark`/`data-density` synchronously,
      // before React hydrates, so the server-rendered markup never matches —
      // that's expected (it's what avoids a flash of the wrong theme), so
      // silence the warning rather than fighting it.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${plusJakartaSans.variable} min-h-full flex flex-col bg-background text-foreground`}>
        <SettingsProvider>
          <AuthProvider>
            <GlobalHeader />
            {children}
            <BackButton />
            <AuthModal />
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

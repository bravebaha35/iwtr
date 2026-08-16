import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { BackButton } from "@/components/BackButton";
import { GlobalHeader } from "@/components/GlobalHeader";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The boot script below sets `.dark`/`data-density` synchronously,
      // before React hydrates, so the server-rendered markup never matches —
      // that's expected (it's what avoids a flash of the wrong theme), so
      // silence the warning rather than fighting it.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SettingsProvider>
          <AuthProvider>
            <GlobalHeader />
            {children}
            <BackButton />
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

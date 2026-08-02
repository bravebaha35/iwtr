import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { SettingsPanel } from "@/components/SettingsPanel";
import "./globals.css";

// Applies the saved theme/density before first paint, so there's no flash
// of the wrong theme on load — mirrors the logic in lib/settings-context.tsx.
// Wrapped in try/catch since localStorage/matchMedia can throw in some
// privacy-locked-down browsers, and a theme glitch shouldn't break the app.
const THEME_BOOT_SCRIPT = `(function(){
  try {
    var theme = localStorage.getItem('iwtr:theme') || 'system';
    var density = localStorage.getItem('iwtr:density') || 'detailed';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-density', density);
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
            {children}
            <SettingsPanel />
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

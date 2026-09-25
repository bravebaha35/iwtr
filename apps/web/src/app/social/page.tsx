import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-auth";
import { AdSlot } from "@/components/AdSlot";
import { SocialShell } from "@/components/social/SocialShell";
import { AnonGate } from "@/components/auth/AnonGate";

export const metadata: Metadata = {
  title: "IWT Social",
  description: "Posts and updates from companies, with anonymous comments from people who worked there.",
};

// Separate route, its own 3-column shell (ad rail / feed / ad rail) - the
// same shell the homepage and company page use. Not nested under any
// existing layout beyond the root. Everything below the heading (search,
// filters, following list, saved posts, the feed itself) is one client
// component (SocialShell) since the sidebar and feed now share filter state.
// AnonGate blocks the whole thing behind a Register prompt for a logged-out
// visitor — same policy as the homepage's WorkplaceBrowser.
export default async function SocialPage() {
  // No session cookie = certainly logged out: render the register prompt on
  // the server instead of after the browser's session check.
  const jar = await cookies();
  const hasSessionCookie = jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);
  return (
    <AnonGate
      assumeAnonymous={!hasSessionCookie}
      title="IWT Social"
      description="Register for free to see what coworkers are posting and join the conversation."
    >
      <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
        <AdSlot />
        <div className="w-full max-w-4xl">
          {/* Visible heading removed per design feedback - kept sr-only for a11y/SEO structure. */}
          <h1 className="sr-only">IWT Social</h1>
          <SocialShell />
        </div>
        <AdSlot />
      </div>
    </AnonGate>
  );
}

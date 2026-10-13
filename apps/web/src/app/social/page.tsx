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

// Separate route: the left ad rail, then SocialShell (filter sidebar, feed,
// and its own right-hand rail, which carries the right-side ad). Not nested
// under any existing layout beyond the root. Everything below the heading is
// one client component since the sidebar and feed share filter state.
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
        <div className="w-full max-w-6xl">
          {/* Visible heading removed per design feedback - kept sr-only for a11y/SEO structure. */}
          <h1 className="sr-only">IWT Social</h1>
          <SocialShell />
        </div>
      </div>
    </AnonGate>
  );
}

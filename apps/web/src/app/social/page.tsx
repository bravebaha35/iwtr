import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-auth";
import { SocialShell } from "@/components/social/SocialShell";
import { AnonGate } from "@/components/auth/AnonGate";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: "IWT Social",
    description: t("Posts and updates from companies, with anonymous comments from people who worked there."),
  };
}

// Separate route: SocialShell lays out the whole row (left ad, filter
// sidebar, feed in the middle of the page, right-hand rail, right ad). Not
// nested under any existing layout beyond the root. Everything below the
// heading is one client component since the sidebar and feed share filter
// state.
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
      <div className="w-full px-4 py-8">
        {/* Visible heading removed per design feedback - kept sr-only for a11y/SEO structure. */}
        <h1 className="sr-only">IWT Social</h1>
        <SocialShell />
      </div>
    </AnonGate>
  );
}

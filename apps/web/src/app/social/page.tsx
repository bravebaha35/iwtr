import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { SocialShell } from "@/components/social/SocialShell";

export const metadata: Metadata = { title: "IWT Social - I Worked There" };

// Separate route, its own 3-column shell (ad rail / feed / ad rail) - the
// same shell the homepage and company page use. Not nested under any
// existing layout beyond the root. Everything below the heading (search,
// filters, following list, saved posts, the feed itself) is one client
// component (SocialShell) since the sidebar and feed now share filter state.
export default function SocialPage() {
  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />
      <div className="w-full max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold text-foreground">IWT Social</h1>
        <SocialShell />
      </div>
      <AdSlot />
    </div>
  );
}

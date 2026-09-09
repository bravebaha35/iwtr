import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { SocialFeed } from "@/components/social/SocialFeed";
import { SocialComposerSlot } from "@/components/social/SocialComposerSlot";
import { SocialWelcomeDialog } from "@/components/social/SocialWelcomeDialog";

export const metadata: Metadata = { title: "IWT Social - I Worked There" };

// Separate route, its own 3-column shell (ad rail / feed / ad rail) - the
// same shell the homepage and company page use. Not nested under any
// existing layout beyond the root.
export default function SocialPage() {
  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />
      <div className="w-full max-w-xl">
        <h1 className="mb-4 text-2xl font-bold text-foreground">IWT Social</h1>
        {/* Employer-only: welcome dialog (once ever) + post composer. Both
            no-op for non-owners. */}
        <SocialWelcomeDialog />
        <SocialComposerSlot />
        <SocialFeed scope={{ kind: "all" }} />
      </div>
      <AdSlot />
    </div>
  );
}

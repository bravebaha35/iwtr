"use client";

import { useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { SidebarContentRow } from "@/components/layout/SidebarShell";
import { WordTabs } from "@/components/WordTabs";
import { SocialSidebar } from "./SocialSidebar";
import { SocialComposerSlot } from "./SocialComposerSlot";
import { SocialWelcomeDialog } from "./SocialWelcomeDialog";
import { SocialFeed } from "./SocialFeed";
import { SocialRail } from "./SocialRail";

type FeedTab = "explore" | "following" | "saved";

const FEED_TABS: { value: FeedTab; label: string }[] = [
  { value: "explore", label: "Explore" },
  { value: "following", label: "Following" },
  { value: "saved", label: "Saved" },
];

// The IWT Social page: filter sidebar, the feed, and the right-hand rail.
// Sidebar and feed share one set of filter/search state, so it's lifted up
// here. This is the one client boundary between the (server) page and its
// client parts; the page itself stays a thin metadata-exporting wrapper.
export function SocialShell() {
  const { isAuthenticated, role } = useAuth();
  // Following and saving are member-only (the API refuses both to an owner
  // or admin), so only a member gets the tab row; everyone else just sees
  // Explore.
  const isMember = isAuthenticated && role === "MEMBER";

  const [query, setQuery] = useState("");
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup | null>(null);
  const [tab, setTab] = useState<FeedTab>("explore");
  const openTab: FeedTab = isMember ? tab : "explore";

  return (
    <>
      <SocialWelcomeDialog />

      <SidebarContentRow>
        <SocialSidebar
          mode="global"
          query={query}
          onQueryChange={setQuery}
          workplaceType={workplaceType}
          onWorkplaceTypeChange={setWorkplaceType}
          categoryGroup={categoryGroup}
          onCategoryGroupChange={setCategoryGroup}
          isMember={isMember}
        />

        {/* The sidebar and the rail keep their own widths; the posts are a
            fixed-width column centered in whatever space is left between
            them, rather than stretching edge to edge. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="flex w-full max-w-xl flex-col gap-5">
            <SocialComposerSlot />
            {isMember && <WordTabs tabs={FEED_TABS} value={openTab} onChange={setTab} label="Which posts to show" />}
            {openTab === "saved" ? (
              <SocialFeed scope={{ kind: "saved" }} />
            ) : (
              <SocialFeed
                scope={{ kind: openTab === "following" ? "following" : "all" }}
                q={query}
                workplaceType={workplaceType}
                categoryGroup={categoryGroup}
              />
            )}
          </div>
        </div>

        <SocialRail />
      </SidebarContentRow>
    </>
  );
}

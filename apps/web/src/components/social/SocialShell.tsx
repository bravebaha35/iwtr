"use client";

import { useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { SocialSidebar } from "./SocialSidebar";
import { SocialComposerSlot } from "./SocialComposerSlot";
import { SocialWelcomeDialog } from "./SocialWelcomeDialog";
import { SocialFeed } from "./SocialFeed";

// Sidebar + feed both need one shared set of filter/search state, so it's
// lifted up here rather than kept feed-local (SocialFeed used to own its own
// `query` state and render its own search box - both moved to the sidebar
// per the brief). This is the one new client boundary between the (server)
// page and the two client components; the page itself stays a thin
// metadata-exporting wrapper.
export function SocialShell() {
  const { isAuthenticated, role } = useAuth();
  const isMember = isAuthenticated && role === "MEMBER";

  const [query, setQuery] = useState("");
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup | null>(null);
  const [savedView, setSavedView] = useState(false);

  return (
    <>
      <SocialWelcomeDialog />
      <SocialComposerSlot />

      <div className="flex flex-col gap-6 sm:flex-row">
        <SocialSidebar
          query={query}
          onQueryChange={setQuery}
          workplaceType={workplaceType}
          onWorkplaceTypeChange={setWorkplaceType}
          categoryGroup={categoryGroup}
          onCategoryGroupChange={setCategoryGroup}
          savedView={savedView}
          onToggleSavedView={() => setSavedView((v) => !v)}
          isMember={isMember}
        />

        {/* The sidebar stays pinned to its own width on the left; the posts
            themselves are a fixed-width column centered in whatever space
            is left, Instagram-style, rather than stretching edge to edge. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-full max-w-xl">
            {savedView ? (
              <SocialFeed scope={{ kind: "saved" }} />
            ) : (
              <SocialFeed scope={{ kind: "all" }} q={query} workplaceType={workplaceType} categoryGroup={categoryGroup} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

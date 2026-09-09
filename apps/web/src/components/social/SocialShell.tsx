"use client";

import { useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
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
  const [category, setCategory] = useState<string | null>(null);
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
          category={category}
          onCategoryChange={setCategory}
          savedView={savedView}
          onToggleSavedView={() => setSavedView((v) => !v)}
          isMember={isMember}
        />

        <div className="min-w-0 flex-1">
          {savedView ? (
            <SocialFeed scope={{ kind: "saved" }} />
          ) : (
            <SocialFeed scope={{ kind: "all" }} q={query} workplaceType={workplaceType} category={category} />
          )}
        </div>
      </div>
    </>
  );
}

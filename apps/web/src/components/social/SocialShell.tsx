"use client";

import { useEffect, useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";
import { SidebarContentRow } from "@/components/layout/SidebarShell";
import { WordTabs } from "@/components/WordTabs";
import { SocialSidebar } from "./SocialSidebar";
import { SocialComposerSlot } from "./SocialComposerSlot";
import { SocialWelcomeDialog } from "./SocialWelcomeDialog";
import { SocialFeed } from "./SocialFeed";
import { SocialRail } from "./SocialRail";
import { QuestionsFeed } from "./QuestionsFeed";

type FeedTab = "explore" | "following" | "saved" | "questions";

const TAB_LABELS: Record<FeedTab, string> = {
  explore: "Explore",
  following: "Following",
  saved: "Saved",
  questions: "Questions",
};

// The IWT Social page: filter sidebar, the feed, and the right-hand rail.
// Sidebar and feed share one set of filter/search state, so it's lifted up
// here. This is the one client boundary between the (server) page and its
// client parts; the page itself stays a thin metadata-exporting wrapper.
export function SocialShell() {
  const { isAuthenticated, role } = useAuth();
  // Following and saving are member-only (the API refuses both to an owner
  // or admin), so only a member gets those two tabs. Questions is for
  // everyone: members ask and answer, an owner answers for their company.
  const isMember = isAuthenticated && role === "MEMBER";
  const tabs: FeedTab[] = ["explore", ...(isMember ? (["following", "saved"] as const) : []), ...(SOCIAL_QUESTIONS_ENABLED ? (["questions"] as const) : [])];

  const [query, setQuery] = useState("");
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup | null>(null);
  const [tab, setTab] = useState<FeedTab>("explore");
  const openTab: FeedTab = tabs.includes(tab) ? tab : "explore";

  // /social?tab=questions opens straight on that tab (the "back" link of a
  // question's page, a notification without a question of its own).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted === "questions" || wanted === "following" || wanted === "saved") setTab(wanted);
  }, []);

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
          searchPlaceholder={openTab === "questions" ? "Search questions..." : undefined}
        />

        {/* The sidebar and the rail keep their own widths; the posts are a
            fixed-width column centered in whatever space is left between
            them, rather than stretching edge to edge. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="flex w-full max-w-xl flex-col gap-5">
            {openTab !== "questions" && <SocialComposerSlot />}
            {tabs.length > 1 && (
              <WordTabs tabs={tabs.map((value) => ({ value, label: TAB_LABELS[value] }))} value={openTab} onChange={setTab} label="What to show" />
            )}
            {openTab === "questions" ? (
              <QuestionsFeed scope={{ kind: "all" }} q={query} workplaceType={workplaceType} categoryGroup={categoryGroup} />
            ) : openTab === "saved" ? (
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

        <SocialRail
          onOpenQuestions={() => {
            setTab("questions");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </SidebarContentRow>
    </>
  );
}

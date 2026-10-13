"use client";

import { useEffect, useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";
import { AdSlot } from "@/components/AdSlot";
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

// The IWT Social page: left ad, filter sidebar, the feed, the right-hand
// rail, right ad. Sidebar and feed share one set of filter/search state, so
// it's lifted up here. This is the one client boundary between the (server)
// page and its client parts; the page itself stays a thin metadata-exporting
// wrapper.
//
// From `lg` up the row is three columns - 1fr, the feed, 1fr - so the posts
// and questions sit in the exact middle of the page whatever is on either
// side of them: the two side columns are equal, the left one's content
// (ad, sidebar) pushed against the feed from the left and the right one's
// (rail, ad) from the right. The two sides hold different things, so each
// is given the wider one's width as its minimum at every step (SIDE_MIN):
// the feed then narrows a little on a smaller window, but never leaves the
// middle. Below `lg` there is no rail and the feed sits beside the sidebar.
// What each side holds, widest first: lg = sidebar 14rem | rail 18rem;
// from 86rem the left ad joins (10rem + 1.5rem gap) = 25.5rem | 18rem; from
// 100rem the right ad has its own column too = 25.5rem | 29.5rem. The left
// ad waits for 86rem (not `xl`, as on other pages) so the feed is never
// squeezed below about 30rem to make room for it.
const SIDE_MIN = "lg:min-w-72 min-[86rem]:min-w-[25.5rem] min-[100rem]:min-w-[29.5rem]";

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

      <div className="flex flex-col gap-6 sm:flex-row lg:grid lg:grid-cols-[1fr_minmax(0,36rem)_1fr] lg:items-start">
        <div className={`flex shrink-0 flex-col gap-6 sm:flex-row sm:items-start lg:justify-end ${SIDE_MIN}`}>
          <AdSlot show="roomy" />
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
        </div>

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

        <div className={`hidden items-start gap-6 lg:flex ${SIDE_MIN}`}>
          <SocialRail
            onOpenQuestions={() => {
              setTab("questions");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <AdSlot side="right" show="wide" />
        </div>
      </div>
    </>
  );
}

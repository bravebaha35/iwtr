import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { OwnedCompany, ScheduledSocialPost, ScheduledSocialPostList, SocialInsights } from "@iwtr/shared-types";
import { SocialInsightsPanel, forgetSocialInsights } from "../SocialInsightsPanel";
import { ScheduledPostsPanel } from "../ScheduledPostsPanel";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

const api = jest.mocked(apiClient);
const paths = () => api.apiGet.mock.calls.map(([path]) => path);

function insights(over: Partial<SocialInsights> = {}): SocialInsights {
  const days = over.days ?? 30;
  return {
    tier: "STARTER",
    days,
    maxDays: 30,
    followers: { now: 48, gained: 9, lost: 2 },
    views: 1310,
    reactions: 61,
    comments: 14,
    posts: 3,
    series: Array.from({ length: days }, (_, i) => ({
      day: new Date(Date.UTC(2026, 8, 15 + i)).toISOString().slice(0, 10),
      followers: 41 + Math.floor(i / 4),
      views: 20 + i,
    })),
    topPosts: [
      { postId: "p1", kind: "MILESTONE", text: "10 years in business", thumbUrl: null, createdAt: "2026-10-10T09:00:00.000Z", views: 640, reactions: 31, comments: 8 },
      { postId: "p2", kind: "POLL", text: null, thumbUrl: "/u/p2.webp", createdAt: "2026-10-12T09:00:00.000Z", views: 410, reactions: 20, comments: 6 },
    ],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  forgetSocialInsights();
});

describe("SocialInsightsPanel", () => {
  it("shows the period's numbers, both charts and the posts by views", async () => {
    api.apiGet.mockResolvedValue(insights() as never);
    render(<SocialInsightsPanel companyId="c1" companyName="Acme" onOpenPricing={jest.fn()} />);

    const followers = (await screen.findByText("Followers", { selector: "dt" })).parentElement as HTMLElement;
    expect(paths()).toEqual(["/social/company-insights/c1?days=30"]);
    expect(within(followers).getByText("48")).toBeInTheDocument();
    expect(within(followers).getByText("9 new, 2 left in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("1,310")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    // Said in plain words: counts, never who.
    expect(screen.getByText(/counts only/)).toBeInTheDocument();

    expect(screen.getByRole("img", { name: /Followers went from 41 on 15 Sept? to 48 on 14 Oct/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /post views between/ })).toBeInTheDocument();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      [expect.stringContaining("10 years in business"), "640", "31", "8"],
      [expect.stringContaining("Poll post"), "410", "20", "6"],
    ]);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/social/posts/p1");
  });

  it("marks the period the plan gave, and a longer one opens the plans instead of asking for it", async () => {
    // A Free company asking for 30 days is given its 7.
    api.apiGet.mockResolvedValue(insights({ tier: "FREE", days: 7, maxDays: 7 }) as never);
    const onOpenPricing = jest.fn();
    render(<SocialInsightsPanel companyId="c1" companyName="Acme" onOpenPricing={onOpenPricing} />);

    expect(await screen.findByText(/Your Free plan looks back 7 days/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "90 days" }));
    expect(onOpenPricing).toHaveBeenCalledTimes(1);
    expect(paths()).toEqual(["/social/company-insights/c1?days=30"]);
  });

  it("reads another period when one the plan covers is picked", async () => {
    api.apiGet.mockImplementation((path: string) =>
      Promise.resolve((path.endsWith("days=7") ? insights({ days: 7, views: 77 }) : insights()) as never),
    );
    render(<SocialInsightsPanel companyId="c1" companyName="Acme" onOpenPricing={jest.fn()} />);
    await screen.findByText("1,310");

    fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    expect(await screen.findByText("77")).toBeInTheDocument();
    expect(paths()).toContain("/social/company-insights/c1?days=7");
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");
  });

  it("says so when there is nothing to show yet", async () => {
    api.apiGet.mockResolvedValue(
      insights({ followers: { now: 0, gained: 0, lost: 0 }, views: 0, reactions: 0, comments: 0, posts: 0, topPosts: [] }) as never,
    );
    render(<SocialInsightsPanel companyId="c1" companyName="Acme" onOpenPricing={jest.fn()} />);
    expect(await screen.findByText(/Nothing to show yet/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

const company: OwnedCompany = { companyId: "c1", companyName: "Acme", companySlug: "acme", tier: "STARTER", planStatus: "ACTIVE", isVerifiedBadge: true };

function waitingPost(over: Partial<ScheduledSocialPost> = {}): ScheduledSocialPost {
  return {
    id: "s1",
    companyId: "c1",
    kind: "UPDATE",
    publishAt: "2026-10-16T06:00:00.000Z",
    status: "SCHEDULED",
    failureReason: null,
    caption: "We moved offices.",
    title: null,
    imageUrls: [],
    pollOptions: [],
    ...over,
  };
}
const list = (posts: ScheduledSocialPost[], over: Partial<ScheduledSocialPostList> = {}): ScheduledSocialPostList => ({
  posts,
  tier: "STARTER",
  limit: 3,
  waiting: posts.filter((p) => p.status === "SCHEDULED").length,
  ...over,
});

describe("ScheduledPostsPanel", () => {
  it("lists what is waiting, with what the plan allows", async () => {
    api.apiGet.mockResolvedValue(
      list([waitingPost(), waitingPost({ id: "s2", kind: "HIRING", status: "FAILED", failureReason: "The job posting is no longer open.", caption: null })]) as never,
    );
    render(<ScheduledPostsPanel company={company} onOpenPricing={jest.fn()} />);

    expect(await screen.findByText("We moved offices.")).toBeInTheDocument();
    expect(paths()).toEqual(["/social/company-scheduled/c1"]);
    expect(screen.getByText(/Your Starter plan keeps up to 3 waiting/)).toBeInTheDocument();
    expect(screen.getByText("1 waiting now")).toBeInTheDocument();
    // The one that could not go out says why.
    expect(screen.getByText("Did not go out")).toBeInTheDocument();
    expect(screen.getByText("The job posting is no longer open.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick a new time" })).toBeInTheDocument();
  });

  it("a Free company is told which plans have it, and gets no form", async () => {
    api.apiGet.mockResolvedValue(list([], { tier: "FREE", limit: 0 }) as never);
    const onOpenPricing = jest.fn();
    render(<ScheduledPostsPanel company={{ ...company, tier: "FREE", planStatus: "NONE" }} onOpenPricing={onOpenPricing} />);

    expect(await screen.findByText(/part of the Starter plan and above/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule a post" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare plans" }));
    expect(onOpenPricing).toHaveBeenCalled();
  });

  it("stops at the plan's number", async () => {
    api.apiGet.mockResolvedValue(list([waitingPost(), waitingPost({ id: "s2" }), waitingPost({ id: "s3" })]) as never);
    render(<ScheduledPostsPanel company={company} onOpenPricing={jest.fn()} />);
    expect(await screen.findByRole("button", { name: "Schedule a post" })).toBeDisabled();
    expect(screen.getByText(/the most your plan keeps waiting/)).toBeInTheDocument();
  });

  it("Post now, Change time and Delete each call their own route and read the list again", async () => {
    api.apiGet.mockResolvedValue(list([waitingPost()]) as never);
    api.apiPost.mockResolvedValue({ id: "post-1" } as never);
    api.apiPatch.mockResolvedValue(waitingPost() as never);
    api.apiDelete.mockResolvedValue({ success: true } as never);
    render(<ScheduledPostsPanel company={company} onOpenPricing={jest.fn()} />);
    await screen.findByText("We moved offices.");

    fireEvent.click(screen.getByRole("button", { name: "Post now" }));
    await waitFor(() => expect(api.apiPost).toHaveBeenCalledWith("/social/scheduled-posts/s1/publish-now", {}));
    await waitFor(() => expect(api.apiGet).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    fireEvent.change(screen.getByLabelText("New date and time"), { target: { value: "2026-10-20T10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.apiPatch).toHaveBeenCalledWith("/social/scheduled-posts/s1", { publishAt: new Date("2026-10-20T10:30").toISOString() }),
    );

    // Delete asks once before it does anything.
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.apiDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/It will not go out/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.apiDelete).toHaveBeenCalledWith("/social/scheduled-posts/s1"));
  });

  it("says so when a post could not be sent out", async () => {
    api.apiGet.mockResolvedValue(list([waitingPost()]) as never);
    api.apiPost.mockRejectedValue(new Error("network"));
    render(<ScheduledPostsPanel company={company} onOpenPricing={jest.fn()} />);
    await screen.findByText("We moved offices.");
    fireEvent.click(screen.getByRole("button", { name: "Post now" }));
    expect(await screen.findByText("Couldn't post that.")).toBeInTheDocument();
  });
});

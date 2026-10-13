import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { SocialRail as SocialRailData } from "@iwtr/shared-types";
import { SocialRail } from "../SocialRail";
import { clearSocialCache } from "../socialFeedCache";
import * as apiClient from "@/lib/api-client";

const openAuthModal = jest.fn();
const toggleFollow = jest.fn();
let mockAuth: { isAuthenticated: boolean; openAuthModal: jest.Mock };
let mockFollowed: { followedIds: Set<string>; canFollow: boolean; toggleFollow: jest.Mock };
jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));

const rail: SocialRailData = {
  trending: [
    { postId: "p1", companyName: "Acme", companyLogoUrl: null, thumbUrl: "/u/p1.webp", caption: "New line opened", likeCount: 2, commentCount: 1 },
    { postId: "p2", companyName: "Borusan", companyLogoUrl: null, thumbUrl: null, caption: "Which shift?", likeCount: 0, commentCount: 4 },
  ],
  suggestedCompanies: [
    { companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "PRO", companyWorkplaceTypes: ["SERVICE"] },
  ],
  hiringNow: [{ jobPostingId: "j1", jobTitle: "Forklift Operator", companySlug: "acme", companyName: "Acme", companyLogoUrl: null }],
  openQuestions: [
    { questionId: "q1", body: "Is overtime paid on time?", companyName: "Acme", workType: null },
    { questionId: "q2", body: "How are the night shifts?", companyName: null, workType: "SERVICE" },
  ],
};
const empty: SocialRailData = { trending: [], suggestedCompanies: [], hiringNow: [], openQuestions: [] };

beforeEach(() => {
  clearSocialCache();
  jest.mocked(apiClient.apiGet).mockReset();
  openAuthModal.mockClear();
  toggleFollow.mockClear();
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
});

it("fills all three panels from one request, with links, and Follow follows the suggested company", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(rail);
  render(<SocialRail />);

  const trending = (await screen.findByRole("heading", { name: "Trending this week" })).closest("section")!;
  const links = within(trending).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/social/posts/p1", "/social/posts/p2"]);
  expect(within(trending).getByText(/2 likes/)).toHaveTextContent("1 comment");
  // A post without a photo shows no broken thumbnail.
  expect(trending.querySelectorAll("img")).toHaveLength(1);

  const hiring = screen.getByRole("heading", { name: "Hiring this week" }).closest("section")!;
  expect(within(hiring).getByRole("link", { name: /Forklift Operator/ })).toHaveAttribute("href", "/companies/acme?tab=jobs");

  fireEvent.click(screen.getByRole("button", { name: "Follow Acme" }));
  expect(toggleFollow).toHaveBeenCalledWith("c1", expect.objectContaining({ companySlug: "acme" }));
  expect(apiClient.apiGet).toHaveBeenCalledTimes(1);
  expect(apiClient.apiGet).toHaveBeenCalledWith("/social/rail");
});

it("lists the questions still waiting for an answer, each linking to its own page, and 'See all' switches the tab", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(rail);
  const onOpenQuestions = jest.fn();
  render(<SocialRail onOpenQuestions={onOpenQuestions} />);

  const waiting = (await screen.findByRole("heading", { name: "Waiting for an answer" })).closest("section")!;
  expect(within(waiting).getByRole("link", { name: /Is overtime paid on time\?/ })).toHaveAttribute("href", "/social/questions/q1");
  expect(within(waiting).getByText("Asked to Acme")).toBeInTheDocument();
  expect(within(waiting).getByText("Asked in Service work")).toBeInTheDocument();

  fireEvent.click(within(waiting).getByRole("link", { name: "See all questions" }));
  expect(onOpenQuestions).toHaveBeenCalledTimes(1);
});

it("shows no panel at all for an empty list", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(empty);
  render(<SocialRail />);
  await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("shows what it last answered straight away on a return visit, before the new answer lands", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(rail);
  const first = render(<SocialRail />);
  await screen.findByRole("heading", { name: "Hiring this week" });
  first.unmount();

  jest.mocked(apiClient.apiGet).mockReturnValue(new Promise(() => undefined));
  render(<SocialRail />);
  expect(screen.getByRole("heading", { name: "Hiring this week" })).toBeInTheDocument();
});

it("shows an owner (who can't follow) no Companies to follow panel, and sends a logged-out visitor to sign in", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(rail);
  mockFollowed = { followedIds: new Set(), canFollow: false, toggleFollow };
  const { unmount } = render(<SocialRail />);
  await screen.findByRole("heading", { name: "Hiring this week" });
  expect(screen.queryByRole("heading", { name: "Companies to follow" })).not.toBeInTheDocument();
  unmount();

  mockAuth = { isAuthenticated: false, openAuthModal };
  render(<SocialRail />);
  fireEvent.click(await screen.findByRole("button", { name: "Follow Acme" }));
  expect(openAuthModal).toHaveBeenCalledTimes(1);
  expect(toggleFollow).not.toHaveBeenCalled();
});

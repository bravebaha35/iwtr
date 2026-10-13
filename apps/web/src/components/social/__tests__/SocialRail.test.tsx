import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { PublicSocialPost, SocialRail as SocialRailData } from "@iwtr/shared-types";
import { SocialRail, mergeTrending } from "../SocialRail";
import * as apiClient from "@/lib/api-client";

const openAuthModal = jest.fn();
const toggleFollow = jest.fn();
let mockAuth: { isAuthenticated: boolean; openAuthModal: jest.Mock };
let mockFollowed: { followedIds: Set<string>; canFollow: boolean; toggleFollow: jest.Mock };
jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));

function post(id: string, likeCount: number, commentCount: number): PublicSocialPost {
  return {
    id, companyId: `c-${id}`, companySlug: id, companyName: `Company ${id}`, companyLogoUrl: null, companyBadgeTier: "FREE",
    companyWorkplaceTypes: ["OFFICE"], imageUrls: [`/u/${id}.webp`], caption: null, createdAt: new Date().toISOString(),
    likeCount, commentCount, likedByMe: null, savedByMe: null, pinned: false, edited: false, canManage: false,
  };
}

const rail: SocialRailData = {
  suggestedCompanies: [
    { companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "PRO", companyWorkplaceTypes: ["SERVICE"] },
  ],
  hiringNow: [{ jobPostingId: "j1", jobTitle: "Forklift Operator", companySlug: "acme", companyName: "Acme", companyLogoUrl: null }],
};

function serve(railData: SocialRailData, trending: { mostLiked: PublicSocialPost[]; mostCommented: PublicSocialPost[] }) {
  jest.mocked(apiClient.apiGet).mockImplementation((path: string) =>
    Promise.resolve(path === "/social/rail" ? railData : trending) as never,
  );
}

beforeEach(() => {
  jest.mocked(apiClient.apiGet).mockClear();
  openAuthModal.mockClear();
  toggleFollow.mockClear();
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
});

it("mergeTrending lists each post once, busiest first, five at most", () => {
  const a = post("a", 1, 0);
  const b = post("b", 4, 3);
  const many = Array.from({ length: 6 }, (_, i) => post(`m${i}`, 0, 1));
  const merged = mergeTrending({ mostLiked: [a, b], mostCommented: [b, ...many] });
  expect(merged).toHaveLength(5);
  expect(merged[0].id).toBe("b");
  expect(merged.filter((p) => p.id === "b")).toHaveLength(1);
});

it("shows the three panels with links, and Follow follows the suggested company", async () => {
  serve(rail, { mostLiked: [post("p1", 2, 1)], mostCommented: [] });
  render(<SocialRail />);

  const trending = (await screen.findByRole("heading", { name: "Trending this week" })).closest("section")!;
  expect(within(trending).getByRole("link")).toHaveAttribute("href", "/social/posts/p1");
  expect(within(trending).getByText(/2 likes/)).toHaveTextContent("1 comment");

  const hiring = screen.getByRole("heading", { name: "Hiring this week" }).closest("section")!;
  expect(within(hiring).getByRole("link", { name: /Forklift Operator/ })).toHaveAttribute("href", "/companies/acme?tab=jobs");

  fireEvent.click(screen.getByRole("button", { name: "Follow Acme" }));
  expect(toggleFollow).toHaveBeenCalledWith("c1", expect.objectContaining({ companySlug: "acme" }));
});

it("shows no panel at all for an empty list", async () => {
  serve({ suggestedCompanies: [], hiringNow: [] }, { mostLiked: [], mostCommented: [] });
  render(<SocialRail />);
  await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("shows an owner (who can't follow) no Companies to follow panel, and sends a logged-out visitor to sign in", async () => {
  serve(rail, { mostLiked: [], mostCommented: [] });
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

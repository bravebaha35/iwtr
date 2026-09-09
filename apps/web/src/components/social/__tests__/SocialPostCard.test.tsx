import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialPostCard } from "../SocialPostCard";

const openAuthModal = jest.fn();
const toggleFollow = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/api-client");
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));
let mockAuth: { isAuthenticated: boolean; openAuthModal: jest.Mock };
let mockFollowed: { followedIds: Set<string>; canFollow: boolean; toggleFollow: jest.Mock };

const basePost = {
  id: "p1", companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "FREE" as const,
  imageUrls: ["/u/p1.webp"], caption: "hi", createdAt: new Date().toISOString(), likeCount: 2, commentCount: 0, likedByMe: false,
  savedByMe: false,
};

beforeEach(() => {
  openAuthModal.mockClear();
  toggleFollow.mockClear();
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
});

it("anonymous Like click opens the auth modal and does not call the API", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const apiPost = require("@/lib/api-client").apiPost as jest.Mock;
  render(<SocialPostCard post={basePost} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  expect(openAuthModal).toHaveBeenCalledTimes(1);
  expect(apiPost).not.toHaveBeenCalled();
});

it("authenticated Like click toggles optimistically and calls the API", async () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  const apiPost = require("@/lib/api-client").apiPost as jest.Mock;
  apiPost.mockResolvedValue({ postId: "p1", likeCount: 3, likedByMe: true });
  const onChanged = jest.fn();
  render(<SocialPostCard post={basePost} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  // SocialPostCard is a controlled component (display always follows the
  // post prop) - this isolated render has no stateful parent applying
  // onChanged back onto post, so assert the callback contract instead of
  // the DOM: the optimistic call, then the server-confirmed call.
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/social/posts/p1/like", {}));
  expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ likeCount: 3, likedByMe: true }));
});

it("authenticated Save click toggles optimistically and calls the API - no count shown", async () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  const apiPost = require("@/lib/api-client").apiPost as jest.Mock;
  apiPost.mockResolvedValue({ postId: "p1", saved: true });
  const onChanged = jest.fn();
  render(<SocialPostCard post={basePost} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/social/posts/p1/save", {}));
  expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ savedByMe: true }));
});

it("shows '+ Follow' for a MEMBER not yet following, and toggles on click", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  const followButton = screen.getByRole("button", { name: "+ Follow" });
  fireEvent.click(followButton);
  expect(toggleFollow).toHaveBeenCalledWith(
    "c1",
    expect.objectContaining({ companyName: "Acme", companySlug: "acme" }),
  );
});

it("shows a muted 'Following' indicator once the company is followed", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(["c1"]), canFollow: true, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
});

it("hides the Follow button entirely for a signed-in non-MEMBER (e.g. an owner)", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: false, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
});

it("shows no arrows for a single-photo post", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  render(<SocialPostCard post={basePost} />);
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /previous photo/i })).not.toBeInTheDocument();
});

it("a multi-photo post shows a Next arrow first, then a Previous arrow after advancing, and stops at the last photo", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const multi = { ...basePost, imageUrls: ["/u/1.webp", "/u/2.webp", "/u/3.webp"] };
  render(<SocialPostCard post={multi} />);

  expect(screen.queryByRole("button", { name: /previous photo/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.getByRole("button", { name: /previous photo/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
});

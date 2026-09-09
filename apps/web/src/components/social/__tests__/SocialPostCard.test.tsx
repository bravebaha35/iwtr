import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialPostCard } from "../SocialPostCard";

const openAuthModal = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/api-client");
let mockAuth: { isAuthenticated: boolean; openAuthModal: jest.Mock };

const basePost = {
  id: "p1", companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "FREE" as const,
  imageUrl: "/u/p1.webp", caption: "hi", createdAt: new Date().toISOString(), likeCount: 2, commentCount: 0, likedByMe: false,
};

beforeEach(() => { openAuthModal.mockClear(); });

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

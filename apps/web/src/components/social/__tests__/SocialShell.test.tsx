import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialShell } from "../SocialShell";
import { clearSocialCache } from "../socialFeedCache";
import * as apiClient from "@/lib/api-client";

let mockAuth: { isAuthenticated: boolean; role: string | null; openAuthModal: jest.Mock };
jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/useIsCompanyOwner", () => ({ useIsCompanyOwner: () => false }));
jest.mock("@/lib/useFollowedCompanies", () => ({
  useFollowedCompanies: () => ({ companies: [], loading: false, followedIds: new Set(), canFollow: true, toggleFollow: jest.fn() }),
}));

const feedCalls = () =>
  jest
    .mocked(apiClient.apiGet)
    .mock.calls.map(([path]) => path)
    .filter((path) => path.startsWith("/social/feed") || path.startsWith("/me/saved-posts"));

beforeEach(() => {
  clearSocialCache();
  jest.mocked(apiClient.apiGet).mockReset();
  jest.mocked(apiClient.apiGet).mockImplementation((path: string) =>
    Promise.resolve(
      path === "/social/rail" ? { trending: [], suggestedCompanies: [], hiringNow: [] } : { posts: [], nextCursor: null },
    ) as never,
  );
});

it("a member gets Explore / Following / Saved, each loading its own list", async () => {
  mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal: jest.fn() };
  render(<SocialShell />);
  expect(screen.getByRole("tab", { name: "Explore" })).toHaveAttribute("aria-selected", "true");
  await waitFor(() => expect(feedCalls()).toEqual(["/social/feed"]));

  fireEvent.click(screen.getByRole("tab", { name: "Following" }));
  await waitFor(() => expect(feedCalls()).toContain("/social/feed?following=1"));

  fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
  await waitFor(() => expect(feedCalls()).toContain("/me/saved-posts"));
  expect(screen.getByRole("tab", { name: "Saved" })).toHaveAttribute("aria-selected", "true");
});

it("an owner (who can't follow or save) gets no tab row, just the full feed", async () => {
  mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal: jest.fn() };
  render(<SocialShell />);
  await waitFor(() => expect(feedCalls()).toEqual(["/social/feed"]));
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});

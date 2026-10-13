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

const questionCalls = () =>
  jest
    .mocked(apiClient.apiGet)
    .mock.calls.map(([path]) => path)
    .filter((path) => path.startsWith("/social/questions") && !path.includes("identity"));

beforeEach(() => {
  clearSocialCache();
  jest.mocked(apiClient.apiGet).mockReset();
  jest.mocked(apiClient.apiGet).mockImplementation((path: string) =>
    Promise.resolve(
      path === "/social/rail"
        ? { trending: [], suggestedCompanies: [], hiringNow: [], openQuestions: [] }
        : path.startsWith("/social/questions/identity")
          ? { displayUsername: "QuietOtter", avatarKey: null, avatarGradient: null }
          : path.startsWith("/social/questions")
            ? { questions: [], nextCursor: null }
            : { posts: [], nextCursor: null },
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

it("an owner (who can't follow or save) gets Explore and Questions only", async () => {
  mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal: jest.fn() };
  render(<SocialShell />);
  await waitFor(() => expect(feedCalls()).toEqual(["/social/feed"]));
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Explore", "Questions"]);

  // An owner answers; only members ask.
  fireEvent.click(screen.getByRole("tab", { name: "Questions" }));
  await waitFor(() => expect(questionCalls()).toEqual(["/social/questions"]));
  expect(await screen.findByText("No questions yet.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Ask/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: "My questions" })).not.toBeInTheDocument();
});

it("a member's Questions tab has the ask box, its own filters, and searches with the sidebar's box", async () => {
  mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal: jest.fn() };
  render(<SocialShell />);
  fireEvent.click(screen.getByRole("tab", { name: "Questions" }));
  await waitFor(() => expect(questionCalls()).toEqual(["/social/questions"]));
  expect(screen.getByRole("button", { name: /Ask people who worked there/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: "Unanswered" }));
  await waitFor(() => expect(questionCalls()).toContain("/social/questions?filter=unanswered"));

  fireEvent.change(screen.getByPlaceholderText("Search questions..."), { target: { value: "overtime" } });
  await waitFor(() => expect(questionCalls()).toContain("/social/questions?q=overtime&filter=unanswered"));
});

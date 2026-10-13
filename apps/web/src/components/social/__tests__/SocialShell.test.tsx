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

it("keeps the feed in the middle of the page: equal side columns, an ad at each outer edge", async () => {
  mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal: jest.fn() };
  render(<SocialShell />);
  await waitFor(() => expect(feedCalls()).toEqual(["/social/feed"]));

  const tablist = screen.getByRole("tablist");
  const row = tablist.closest(".lg\\:grid") as HTMLElement;
  // 1fr, the feed, 1fr: whatever sits left and right, the feed column is centred.
  expect(row).toHaveClass("lg:grid-cols-[1fr_minmax(0,36rem)_1fr]");
  const [left, middle, right] = Array.from(row.children) as HTMLElement[];
  expect(middle).toContainElement(tablist);
  // Both sides get the wider one's width as their minimum at each step, so
  // they stay equal (and the feed centred) on a smaller window too.
  for (const side of [left, right]) expect(side).toHaveClass("lg:min-w-72", "min-[86rem]:min-w-[25.5rem]", "min-[100rem]:min-w-[29.5rem]");

  // Left column: the ad first (outer edge), then the sidebar, pushed against the feed.
  expect(left).toHaveClass("lg:justify-end");
  expect(left.firstElementChild).toHaveAttribute("data-testid", "ad-slot");
  // ...from the width where the feed keeps a comfortable size beside it.
  expect(left.firstElementChild).toHaveClass("hidden", "min-[86rem]:block");
  expect(left).toContainElement(screen.getByLabelText("Search IWT Social"));

  // Right column: the rail, then the ad in a column of its own at the outer
  // edge on a wide window. The copy under the rail only shows where that
  // column does not fit, so the two are never on screen together.
  const rail = screen.getByRole("complementary", { name: "More on IWT Social" });
  expect(right.firstElementChild).toBe(rail);
  const outerAd = right.lastElementChild as HTMLElement;
  expect(outerAd).toHaveAttribute("data-testid", "ad-slot");
  expect(outerAd).toHaveClass("hidden", "min-[100rem]:block");
  const underRail = rail.querySelector('[data-testid="ad-slot"]') as HTMLElement;
  expect(underRail).toHaveClass("xl:block", "min-[100rem]:hidden");
});

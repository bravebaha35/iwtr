import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewsList } from "../ReviewsList";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));

function review(id: string) {
  return {
    id, companyId: "c1", workplaceType: "OFFICE", corporateCultureScore: 3, leadershipScore: 3, infrastructureScore: 3,
    workLifeBalanceScore: 3, stabilityScore: 3, generalThoughts: `thought ${id}`, status: "PUBLISHED",
    publishedAt: new Date().toISOString(), likeCount: 0, dislikeCount: 0, myVote: null, contributorBadge: null,
    reply: null, avatarKey: null, avatarGradient: null, displayUsername: null, district: null, city: null,
  };
}

it("shows only initialVisibleCount reviews with a 'See them all' toggle", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 6 }, (_, i) => review(`r${i}`)));
  render(<ReviewsList companySlug="acme" initialVisibleCount={3} />);
  // generalThoughts renders wrapped in curly quotes ("thought r0"), so a
  // regex substring match is needed - an exact string match against the
  // whole element's text content would never match.
  await waitFor(() => expect(screen.getByText(/thought r0/)).toBeInTheDocument());
  expect(screen.queryByText(/thought r3/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /see them all/i }));
  expect(screen.getByText(/thought r3/)).toBeInTheDocument();
});

it("renders all reviews when initialVisibleCount is omitted", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 6 }, (_, i) => review(`r${i}`)));
  render(<ReviewsList companySlug="acme" />);
  await waitFor(() => expect(screen.getByText(/thought r5/)).toBeInTheDocument());
});

it("reveals, scrolls to and pulses the review a notification linked to", async () => {
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 6 }, (_, i) => review(`r${i}`)));
  render(<ReviewsList companySlug="acme" initialVisibleCount={3} highlightReviewId="r5" />);
  // r5 sits past the collapse, so it has to be revealed first.
  const target = await screen.findByText(/thought r5/);
  const card = target.closest("[id='review-r5']");
  expect(card).toHaveClass("highlight-pulse");
  expect(scrollIntoView).toHaveBeenCalled();
});

it("pins the owner's featured review above all others with a Featured label", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 4 }, (_, i) => review(`r${i}`)));
  const { container } = render(<ReviewsList companySlug="acme" companyName="Acme" featuredReviewId="r3" />);
  await screen.findByText(/thought r3/);
  const cards = [...container.querySelectorAll("[id^='review-']")].map((el) => el.id);
  expect(cards).toEqual(["review-r3", "review-r0", "review-r1", "review-r2"]);
  expect(screen.getByText("Featured by Acme")).toBeInTheDocument();
});

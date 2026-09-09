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

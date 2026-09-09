import { render, screen, waitFor } from "@testing-library/react";
import { SocialFeed } from "../SocialFeed";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, openAuthModal: jest.fn() }) }));
jest.mock("@/lib/useIsCompanyOwner", () => ({ useIsCompanyOwner: () => false }));

function post(id: string, name = "Acme"): any {
  return {
    id, companyId: "c1", companySlug: "acme", companyName: name, companyLogoUrl: null, companyBadgeTier: "FREE",
    imageUrl: `/u/${id}.webp`, caption: null, createdAt: new Date().toISOString(),
    likeCount: 0, commentCount: 0, likedByMe: null,
  };
}

describe("SocialFeed (all)", () => {
  it("renders the first page and injects an AdSlot after every 7th post", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValueOnce({
      posts: Array.from({ length: 9 }, (_, i) => post(`p${i}`)),
      nextCursor: "p8",
    });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    // exactly one ad after 9 posts (7th boundary crossed once)
    expect(screen.getAllByText("Ad space")).toHaveLength(1);
  });

  it("has a company-name search box and no sort/filter controls", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    expect(await screen.findByPlaceholderText(/search .*compan/i)).toBeInTheDocument();
    expect(screen.queryByText(/sort/i)).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyProfileTabs } from "../CompanyProfileTabs";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, openAuthModal: jest.fn() }),
}));

const company = {
  id: "c1", slug: "acme", name: "Acme", category: "Software", workplaceTypes: ["OFFICE"],
  mainPhotoUrl: null, description: null, website: null, city: null, district: null,
  structureType: "SETTLED", region: null, isVerifiedBadge: false, taxNumber: null,
  isChainStore: false, isHiring: false, contactEmail: null, contactPhone: null,
  facebookUrl: null, instagramUrl: null, whatsappUrl: null, xUrl: null, linkedinUrl: null,
  youtubeUrl: null, glassdoorUrl: null, badgeTier: "FREE", bannerImageUrl: null,
  defaultBannerUrl: "/office-default-banner.webp", hasApprovedOwner: false, featuredReviewId: null,
} as const;

function setup(initialTab?: string) {
  (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null, jobPostings: [], jobTitles: [] });
  return render(
    <CompanyProfileTabs
      slug="acme"
      initialTab={initialTab}
      company={company as never}
      aggregate={null}
      ratings={<div>RATINGS PANEL CONTENT</div>}
    />,
  );
}

describe("CompanyProfileTabs", () => {
  it("shows the Ratings panel by default and does not fetch the other tabs' streams", async () => {
    setup();
    expect(screen.getByText("RATINGS PANEL CONTENT")).toBeVisible();
    // Neither the social feed nor the job-postings endpoint is hit until
    // their tab is opened.
    await waitFor(() => expect(apiClient.apiGet).not.toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: "Ratings" })).toHaveAttribute("aria-selected", "true");
  });

  it("mounts the Job Postings stream only after that tab is clicked", async () => {
    const user = userEvent.setup();
    setup();
    expect(apiClient.apiGet).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Job Postings" }));

    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/companies/acme/job-postings"));
    expect(screen.getByRole("tab", { name: "Job Postings" })).toHaveAttribute("aria-selected", "true");
    // Ratings panel stays mounted (just hidden) so its state survives.
    expect(screen.getByText("RATINGS PANEL CONTENT")).not.toBeVisible();
  });

  it("mounts the IWT Social feed only after that tab is clicked", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("tab", { name: "IWT Social" }));

    await waitFor(() =>
      expect(apiClient.apiGet).toHaveBeenCalledWith(expect.stringContaining("/social/companies/acme/posts")),
    );
  });

  it("opens directly on the tab named by initialTab (deep link)", async () => {
    setup("jobs");
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/companies/acme/job-postings"));
    expect(screen.getByRole("tab", { name: "Job Postings" })).toHaveAttribute("aria-selected", "true");
  });

  it("ignores an unknown initialTab and falls back to Ratings", async () => {
    setup("nonsense");
    expect(screen.getByRole("tab", { name: "Ratings" })).toHaveAttribute("aria-selected", "true");
  });

  it("exposes a labelled tablist", () => {
    setup();
    expect(screen.getByRole("tablist", { name: /company profile sections/i })).toBeInTheDocument();
  });
});

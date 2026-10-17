import { render, screen, waitFor } from "@testing-library/react";
import type { Company } from "@iwtr/shared-types";
import { CompanyJobPostings } from "../CompanyJobPostings";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/components/jobs/ApplyButton", () => ({ ApplyButton: () => <button type="button">Apply</button> }));
jest.mock("@/lib/useSavedJobPostings", () => ({
  useSavedJobPostings: () => ({ savedIds: new Set(), canSave: false, toggleSave: jest.fn() }),
}));

const company: Company = {
  id: "c1",
  slug: "acme",
  name: "Acme",
  category: "Software",
  workplaceTypes: ["OFFICE"],
  mainPhotoUrl: null,
  description: null,
  website: null,
  city: "İzmir",
  district: "Buca",
  structureType: "SETTLED",
  region: null,
  isVerifiedBadge: false,
  taxNumber: null,
  isChainStore: false,
  isHiring: true,
  contactEmail: null,
  contactEmail2: null,
  contactEmail3: null,
  contactPhone: null,
  facebookUrl: null,
  instagramUrl: null,
  whatsappUrl: null,
  xUrl: null,
  linkedinUrl: null,
  youtubeUrl: null,
  glassdoorUrl: null,
  badgeTier: "FREE",
  bannerImageUrl: null,
  defaultBannerUrl: "/office-default-banner.webp",
  hasApprovedOwner: false,
  featuredReviewId: null,
  riskScore: 0,
};

const aggregate = null;

describe("CompanyJobPostings", () => {
  it("fetches the per-company job-postings stream by slug", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/companies/acme/job-postings"));
  });

  it("renders one wide role row per owner-authored posting", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({
      jobPostings: [
        { id: "p1", jobTitle: "Forklift Operator", description: "Day shift, warehouse.", workType: "MANUAL_LABOUR", positions: ["BLUE_COLLAR"] },
        { id: "p2", jobTitle: "3D Artist", description: "", workType: null, positions: [] },
      ],
      jobTitles: [{ title: "Accountant", workType: "OFFICE" }], // ignored while explicit postings exist
    });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);

    expect(await screen.findByRole("heading", { name: "Forklift Operator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3D Artist" })).toBeInTheDocument();
    expect(screen.getByText("Day shift, warehouse.")).toBeInTheDocument();
    expect(screen.getByText(/has not written a description/i)).toBeInTheDocument();
    expect(screen.queryByText("Accountant")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    // A short description is never cut off, so there is nothing to open.
    expect(screen.queryByRole("button", { name: /read the full posting/i })).not.toBeInTheDocument();
  });

  it("falls back to the classified job titles when there are no explicit postings", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({
      jobPostings: [],
      jobTitles: [
        { title: "Accountant", workType: "OFFICE" },
        { title: "Recruiter", workType: "OFFICE" },
      ],
    });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);

    expect(await screen.findByText("Accountant")).toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
  });

  it("shows a no-open-roles message when both arrays are empty", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    expect(await screen.findByText(/no open roles right now/i)).toBeInTheDocument();
  });

  it("surfaces a load error instead of a silent empty state", async () => {
    (apiClient.apiGet as jest.Mock).mockRejectedValue(new Error("network"));
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    expect(await screen.findByText(/couldn't load job postings/i)).toBeInTheDocument();
  });
});

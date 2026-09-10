import { render, screen, waitFor } from "@testing-library/react";
import type { Company } from "@iwtr/shared-types";
import { CompanyJobPostings } from "../CompanyJobPostings";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

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
};

const aggregate = null;

describe("CompanyJobPostings", () => {
  it("fetches the per-company job-postings stream by slug", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/companies/acme/job-postings"));
  });

  it("renders a standard job card per owner-authored posting", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({
      jobPostings: [
        { jobTitle: "Forklift Operator", description: "Day shift, warehouse." },
        { jobTitle: "3D Artist", description: null },
      ],
      jobTitles: ["Accountant"], // ignored while explicit postings exist
    });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);

    expect(await screen.findByText("Forklift Operator")).toBeInTheDocument();
    expect(screen.getByText("3D Artist")).toBeInTheDocument();
    expect(screen.getByText("Day shift, warehouse.")).toBeInTheDocument();
    expect(screen.queryByText("Accountant")).not.toBeInTheDocument();
    // the shared JobCard chrome is present (Mail/Call, rating slot, footer)
    expect(screen.getAllByRole("button", { name: /workplace flags/i }).length).toBe(2);
  });

  it("falls back to the classified job titles when there are no explicit postings", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({
      jobPostings: [],
      jobTitles: ["Accountant", "Recruiter"],
    });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);

    expect(await screen.findByText("Accountant")).toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
  });

  it("shows a no-open-roles message when both arrays are empty", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ jobPostings: [], jobTitles: [] });
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    expect(await screen.findByText(/no open roles listed/i)).toBeInTheDocument();
  });

  it("surfaces a load error instead of a silent empty state", async () => {
    (apiClient.apiGet as jest.Mock).mockRejectedValue(new Error("network"));
    render(<CompanyJobPostings company={company} aggregate={aggregate} />);
    expect(await screen.findByText(/couldn't load job postings/i)).toBeInTheDocument();
  });
});

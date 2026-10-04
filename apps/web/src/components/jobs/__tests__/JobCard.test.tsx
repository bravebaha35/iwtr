import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompanyListItem } from "@iwtr/shared-types";
import { JobCard, type CardPosting } from "../JobCard";

jest.mock("@/lib/api-client");
jest.mock("@/lib/useSavedJobPostings", () => ({
  useSavedJobPostings: () => ({ savedIds: new Set(), canSave: false, toggleSave: jest.fn() }),
}));
jest.mock("@/components/jobs/ApplyButton", () => ({ ApplyButton: () => <button type="button">Apply</button> }));

const company = {
  id: "c1",
  slug: "acme",
  name: "Acme Lojistik",
  category: "Logistics",
  workplaceTypes: ["OFFICE"],
  mainPhotoUrl: null,
  city: "İzmir",
  district: "Buca",
  isChainStore: false,
  contactEmail: null,
  contactPhone: null,
  badgeTier: "FREE",
  bannerImageUrl: null,
  defaultBannerUrl: "/office-default-banner.webp",
  hasApprovedOwner: false,
  riskScore: 0,
  overallAvg: 4,
  reviewCount: 3,
  jobTitles: [],
  jobPostings: [],
} as unknown as CompanyListItem;

const LONG = "Day shift in the warehouse. ".repeat(20).trim();
const posting: CardPosting = { id: "p1", jobTitle: "Forklift Operator", description: LONG, workType: "OFFICE" };

describe("JobCard sizes", () => {
  it("the full card (a company's own Jobs tab) has no '...' button", () => {
    render(<JobCard company={company} posting={posting} />);
    expect(screen.queryByRole("button", { name: "Show the full job posting" })).not.toBeInTheDocument();
    expect(screen.getByText(LONG)).not.toHaveClass("line-clamp-3");
  });

  it("the compact card (/jobs) cuts the description to three lines", () => {
    render(<JobCard company={company} posting={posting} variant="compact" />);
    expect(screen.getByText(LONG)).toHaveClass("line-clamp-3");
  });

  it("'...' opens a floating copy with the whole description; Esc closes it", async () => {
    render(<JobCard company={company} posting={posting} variant="compact" />);
    const more = screen.getByRole("button", { name: "Show the full job posting" });
    await userEvent.click(more);

    const panel = screen.getByRole("dialog", { name: "Forklift Operator at Acme Lojistik" });
    expect(within(panel).getByText(LONG)).not.toHaveClass("line-clamp-3");
    expect(more).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it("closes from its own close button and from a click outside", async () => {
    render(
      <>
        <p>outside</p>
        <JobCard company={company} posting={posting} variant="compact" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show the full job posting" }));
    await userEvent.click(screen.getByRole("button", { name: "Close the full job posting" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show the full job posting" }));
    await userEvent.click(screen.getByText("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

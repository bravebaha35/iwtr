import { render, screen, within } from "@testing-library/react";
import type { CompanyListItem } from "@iwtr/shared-types";
import { JobsBrowser } from "../JobsBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, role: null, onboardingStatus: null, isLoading: false }),
}));
jest.mock("@/components/jobs/ApplyButton", () => ({ ApplyButton: () => null }));

const get = apiGet as jest.Mock;
const serve = (browse: object) =>
  get.mockImplementation((path: string) =>
    path.startsWith("/companies/browse?") ? Promise.resolve(browse) : path === "/me/profile" ? Promise.reject(new Error("401")) : Promise.resolve(null),
  );

const company = (id: string, postings: { id: string; jobTitle: string }[]) =>
  ({
    id,
    slug: id,
    name: `Company ${id}`,
    category: "Logistics",
    workplaceTypes: ["OFFICE"],
    mainPhotoUrl: null,
    city: "İzmir",
    district: null,
    isChainStore: false,
    badgeTier: "FREE",
    bannerImageUrl: null,
    defaultBannerUrl: "/office-default-banner.webp",
    hasApprovedOwner: true,
    riskScore: 0,
    overallAvg: 4,
    reviewCount: 3,
    jobTitles: [],
    jobPostings: postings.map((p) => ({ ...p, description: `${p.jobTitle} wanted`, workType: "OFFICE" })),
  }) as unknown as CompanyListItem;

const a = company("a", [
  { id: "p1", jobTitle: "Forklift Operatörü" },
  { id: "p2", jobTitle: "Depo Sorumlusu" },
]);
const b = company("b", [{ id: "p3", jobTitle: "Muhasebe Uzmanı" }]);

beforeEach(() => {
  get.mockReset();
  clearBrowseCache();
});

it("shows boosted jobs first on page 1, a line under them, and doesn't repeat them below", async () => {
  serve({
    items: [a, b],
    total: 2,
    page: 1,
    pageSize: 20,
    hiddenUnratedCount: 0,
    featured: [
      { company: a, posting: a.jobPostings[0] },
      { company: b, posting: b.jobPostings[0] },
    ],
  });
  render(<JobsBrowser />);
  const row = await screen.findByRole("region", { name: "Featured jobs" });
  expect(within(row).getByText("Forklift Operatörü")).toBeInTheDocument();
  expect(within(row).getByText("Muhasebe Uzmanı")).toBeInTheDocument();
  expect(within(row).getByRole("separator")).toBeInTheDocument();
  // Standard cards below: only the one posting that isn't featured.
  expect(screen.getAllByText("Forklift Operatörü")).toHaveLength(1);
  expect(screen.getAllByText("Muhasebe Uzmanı")).toHaveLength(1);
  expect(screen.getByText("Depo Sorumlusu")).toBeInTheDocument();
});

it("has no featured row when nothing is boosted", async () => {
  serve({ items: [a], total: 1, page: 1, pageSize: 20, hiddenUnratedCount: 0, featured: [] });
  render(<JobsBrowser />);
  await screen.findByText("Depo Sorumlusu");
  expect(screen.queryByRole("region", { name: "Featured jobs" })).not.toBeInTheDocument();
});

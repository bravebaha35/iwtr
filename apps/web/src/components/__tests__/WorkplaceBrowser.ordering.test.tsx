import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkplaceBrowser } from "../WorkplaceBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

function company(name: string, reviewCount: number, extra: Record<string, unknown> = {}) {
  return {
    id: `id-${name}`,
    slug: name.toLowerCase(),
    name,
    category: "Consulting",
    workplaceTypes: ["OFFICE"],
    city: "İstanbul",
    district: null,
    mainPhotoUrl: null,
    bannerImageUrl: null,
    defaultBannerUrl: "/banners/office.webp",
    badgeTier: "FREE",
    hasApprovedOwner: false,
    isHiring: false,
    riskScore: 0,
    overallAvg: reviewCount > 0 ? 4 : null,
    reviewCount,
    jobTitles: [],
    jobPostings: [],
    ...extra,
  };
}

// Stands in for GET /companies/browse: the server decides what shows and in
// which order (unreviewed workplaces only for A-Z, after the reviewed ones).
const rated = company("Rated Co", 3, { isHiring: true, riskScore: 2 });
const empty = company("Empty Co", 0);
jest.mock("@/lib/api-client", () => ({
  apiGet: jest.fn((path: string) => {
    const az = path.includes("sort=alphabetical");
    const items = az ? [rated, empty] : [rated];
    return Promise.resolve({ items, total: items.length, page: 1, pageSize: 20, hiddenUnratedCount: az ? 0 : 1 });
  }),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  clearBrowseCache();
  (apiGet as jest.Mock).mockClear();
});

function cardNames() {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
}

it("opens on rated workplaces only, and A-Z brings unreviewed ones in after them", async () => {
  render(<WorkplaceBrowser />);
  expect(await screen.findByText("Rated Co")).toBeInTheDocument();
  expect(screen.queryByText("Empty Co")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "A-Z" }));
  expect(await screen.findByText("Empty Co")).toBeInTheDocument();
  // Rated first even though "Empty Co" comes first alphabetically.
  expect(cardNames()).toEqual(["Rated Co", "Empty Co"]);
});

it("asks the server for one page, never the whole directory", async () => {
  render(<WorkplaceBrowser />);
  await screen.findByText("Rated Co");
  const paths = (apiGet as jest.Mock).mock.calls.map(([path]) => path as string);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.every((path) => path.startsWith("/companies/browse?") && path.includes("page=1"))).toBe(true);
});

it("shows each card's Risk Score", async () => {
  render(<WorkplaceBrowser />);
  const card = (await screen.findByText("Rated Co")).closest("a")!;
  expect(within(card).getByText("Risk Score 2 of 3")).toBeInTheDocument();
});

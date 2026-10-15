import { render, waitFor } from "@testing-library/react";
import { JobsBrowser, forgetMemberField } from "../JobsBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, role: "MEMBER", onboardingStatus: null, isLoading: false }),
}));

const get = apiGet as jest.Mock;
const empty = { items: [], total: 0, page: 1, pageSize: 20, hiddenUnratedCount: 0, featured: [] };

function serve(profile: object | null) {
  get.mockImplementation((path: string) => {
    if (path === "/me/profile") return profile ? Promise.resolve(profile) : Promise.reject(new Error("401"));
    if (path.startsWith("/companies/browse?")) return Promise.resolve(empty);
    return Promise.resolve(null);
  });
}

const browsePaths = () => get.mock.calls.map(([p]) => String(p)).filter((p) => p.startsWith("/companies/browse?"));

beforeEach(() => {
  get.mockReset();
  clearBrowseCache();
  forgetMemberField();
});

it("opens on every job - the profile never filters the job grid", async () => {
  serve({ sector: { value: "IT", label: "Information Technology (IT)" }, workType: "OFFICE" });
  render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));
  expect(browsePaths().every((p) => !p.includes("workplaceTypes=") && !p.includes("category="))).toBe(true);
});

it("tells the featured row the member's sector and kind of work", async () => {
  serve({ sector: { value: "IT", label: "Information Technology (IT)" }, workType: "OFFICE" });
  render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));
  expect(browsePaths()[0]).toContain("forSector=IT");
  expect(browsePaths()[0]).toContain("forWorkType=OFFICE");
});

it("sends no field for a visitor without a profile", async () => {
  serve(null);
  render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));
  expect(browsePaths()[0]).not.toContain("forSector");
});

it("asks a signed-in member's profile once, then remembers it", async () => {
  serve({ sector: { value: "IT", label: "Information Technology (IT)" }, workType: "OFFICE" });
  const first = render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));
  first.unmount();
  render(<JobsBrowser />);
  await new Promise((r) => setTimeout(r, 50));
  expect(get.mock.calls.filter(([p]) => p === "/me/profile")).toHaveLength(1);
});

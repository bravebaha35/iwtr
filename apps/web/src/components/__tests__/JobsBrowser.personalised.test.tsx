import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsBrowser } from "../JobsBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, role: null, onboardingStatus: null, isLoading: false }),
}));

const get = apiGet as jest.Mock;
const empty = { items: [], total: 0, page: 1, pageSize: 16, hiddenUnratedCount: 0 };
const some = { ...empty, total: 3 };

// profile: what GET /me/profile returns; totals: how many hiring companies a
// given browse query string has.
function serve(profile: object | Error, totals: (path: string) => typeof empty) {
  get.mockImplementation((path: string) => {
    if (path === "/me/profile") return profile instanceof Error ? Promise.reject(profile) : Promise.resolve(profile);
    if (path.startsWith("/companies/browse?")) return Promise.resolve(totals(path));
    return Promise.resolve([]);
  });
}

const browsePaths = () => get.mock.calls.map(([p]) => p as string).filter((p) => p.startsWith("/companies/browse?"));

beforeEach(() => {
  get.mockReset();
  clearBrowseCache();
});

it("opens on the member's sector when it has open jobs", async () => {
  serve({ sector: { value: "IT", label: "Information Technology (IT)" }, workType: "OFFICE" }, () => some);
  render(<JobsBrowser />);
  expect(await screen.findByText(/Showing jobs for your sector/)).toHaveTextContent("Information Technology (IT)");
  expect(browsePaths().every((p) => p.includes("category=IT"))).toBe(true);
});

it("falls back to the kind of work when the sector has no open jobs", async () => {
  serve({ sector: { value: "IT", label: "Information Technology (IT)" }, workType: "SERVICE" }, (p) =>
    p.includes("category=IT") ? empty : some,
  );
  render(<JobsBrowser />);
  expect(await screen.findByText(/Showing jobs for your kind of work/)).toBeInTheDocument();
  expect(browsePaths().at(-1)).toContain("workplaceTypes=SERVICE");
});

it("shows every job when the profile has neither, and 'Show all jobs' clears an applied filter", async () => {
  serve({ sector: null, workType: null }, () => some);
  const { unmount } = render(<JobsBrowser />);
  await screen.findByText(/companies hiring/);
  expect(screen.queryByText(/from your profile/)).not.toBeInTheDocument();
  expect(browsePaths()).toEqual(["/companies/browse?jobs=1&page=1"]);
  unmount();

  get.mockReset();
  clearBrowseCache();
  serve({ sector: null, workType: "OFFICE" }, () => some);
  render(<JobsBrowser />);
  await userEvent.click(await screen.findByRole("button", { name: "Show all jobs" }));
  expect(screen.queryByText(/from your profile/)).not.toBeInTheDocument();
  await waitFor(() => expect(browsePaths().at(-1)).toBe("/companies/browse?jobs=1&page=1"));
});

it("still loads every job when the profile can't be read", async () => {
  serve(new Error("offline"), () => some);
  render(<JobsBrowser />);
  await screen.findByText(/companies hiring/);
  expect(browsePaths()).toEqual(["/companies/browse?jobs=1&page=1"]);
});

import { render, waitFor } from "@testing-library/react";
import { JobsBrowser } from "../JobsBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, role: "MEMBER", onboardingStatus: null, isLoading: false }),
}));

const get = apiGet as jest.Mock;
const empty = { items: [], total: 0, page: 1, pageSize: 20, hiddenUnratedCount: 0 };

beforeEach(() => {
  get.mockReset();
  clearBrowseCache();
  get.mockImplementation((path: string) =>
    Promise.resolve(path.startsWith("/companies/browse?") ? empty : []),
  );
});

it("opens on every job, without reading the member's profile", async () => {
  render(<JobsBrowser />);
  await waitFor(() => expect(get.mock.calls.some(([p]) => String(p).startsWith("/companies/browse?"))).toBe(true));
  const paths = get.mock.calls.map(([p]) => String(p));
  expect(paths).not.toContain("/me/profile");
  const browse = paths.filter((p) => p.startsWith("/companies/browse?"));
  expect(browse.every((p) => !p.includes("workplaceTypes=") && !p.includes("category="))).toBe(true);
});

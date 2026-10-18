import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsBrowser } from "../JobsBrowser";
import { apiGet } from "@/lib/api-client";
import { clearBrowseCache } from "@/lib/companyBrowse";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, role: "MEMBER", onboardingStatus: null, isLoading: false }),
}));

const get = apiGet as jest.Mock;
const empty = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1, hiddenUnratedCount: 0, featured: [] };
const browsePaths = () =>
  get.mock.calls.map(([p]) => decodeURIComponent(String(p))).filter((p) => p.startsWith("/companies/browse?"));
const lastBrowse = () => browsePaths()[browsePaths().length - 1];

function serve(browse: object) {
  get.mockImplementation((path: string) => {
    if (path === "/me/profile") return Promise.reject(new Error("401"));
    if (path.startsWith("/companies/browse?")) return Promise.resolve(browse);
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  get.mockReset();
  clearBrowseCache();
  serve(empty);
});

it("the Sector list takes several ticks at once", async () => {
  const user = userEvent.setup();
  render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));

  await user.click(screen.getByRole("button", { name: "Sector" }));
  await user.click(screen.getByRole("option", { name: "Agriculture" }));
  await user.click(screen.getByRole("option", { name: "Construction" }));
  // Ticking keeps the list open, and both stay ticked.
  expect(screen.getByRole("option", { name: "Agriculture" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("option", { name: "Construction" })).toHaveAttribute("aria-selected", "true");

  await waitFor(() => expect(lastBrowse()).toContain("categories=Agriculture|Construction"));
});

it("the Position dropdown filters the job list", async () => {
  const user = userEvent.setup();
  render(<JobsBrowser />);
  await waitFor(() => expect(browsePaths().length).toBeGreaterThan(0));

  await user.click(screen.getByRole("button", { name: "Position" }));
  await user.click(screen.getByRole("option", { name: "Intern" }));
  await user.click(screen.getByRole("option", { name: "Specialist" }));
  await waitFor(() => expect(lastBrowse()).toContain("positions=INTERN,SPECIALIST"));
  expect(await screen.findByText(/No job posting is hiring for the ticked position/)).toBeInTheDocument();
});

it("takes the page count from the server (page 1 is shorter than the rest)", async () => {
  serve({ ...empty, total: 33, pageSize: 12, totalPages: 3 });
  render(<JobsBrowser />);
  expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument();
});

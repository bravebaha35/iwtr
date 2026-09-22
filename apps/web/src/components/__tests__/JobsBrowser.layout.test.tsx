import { render, screen } from "@testing-library/react";
import { JobsBrowser } from "../JobsBrowser";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn(() => Promise.resolve([])) }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, role: null, onboardingStatus: null, isLoading: false }),
}));

it("renders the Jobs page sidebar inside a SidebarShell aside", () => {
  render(<JobsBrowser />);
  const heading = screen.getByText("Work-Type");
  const aside = heading.closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

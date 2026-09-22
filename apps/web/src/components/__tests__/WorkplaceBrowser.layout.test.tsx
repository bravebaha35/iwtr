import { render, screen } from "@testing-library/react";
import { WorkplaceBrowser } from "../WorkplaceBrowser";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn(() => Promise.resolve([])) }));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

it("renders the Work-Type filter inside a SidebarShell aside", () => {
  render(<WorkplaceBrowser />);
  const heading = screen.getByText("Work-Type");
  const aside = heading.closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

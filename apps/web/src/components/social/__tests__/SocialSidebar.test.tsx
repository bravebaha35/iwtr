import { render, screen, fireEvent } from "@testing-library/react";
import { SocialSidebar } from "../SocialSidebar";

let mockFollowed: { companies: unknown[]; loading: boolean };
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));

const baseProps = {
  mode: "global" as const,
  query: "",
  onQueryChange: jest.fn(),
  workplaceType: null,
  onWorkplaceTypeChange: jest.fn(),
  categoryGroup: null,
  onCategoryGroupChange: jest.fn(),
};

beforeEach(() => {
  mockFollowed = { companies: [], loading: false };
  jest.clearAllMocks();
});

it("renders the moved search box and all 7 Quick Select groups as a vertical list with names", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.getByPlaceholderText(/search a company by name/i)).toBeInTheDocument();
  expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-orientation", "vertical");
  for (const label of ["Firms", "Supermarket", "Franchises", "Logistics", "Clothing", "Service Providers", "Oil & Energy"]) {
    expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
  }
});

it("renders 'Only Show Me' as the four Work-Type tiles, with only the picked one pressed", () => {
  render(<SocialSidebar {...baseProps} isMember={false} workplaceType="SERVICE" />);
  expect(screen.queryByRole("button", { name: "Only show me:" })).not.toBeInTheDocument();
  for (const label of ["Office", "Hybrid/Remote", "Service", "Manual-Labour"]) {
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", String(label === "Service"));
  }
});

it("'Only Show Me' clears on a second click of the picked tile and on its reset button", () => {
  const onWorkplaceTypeChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} workplaceType="SERVICE" onWorkplaceTypeChange={onWorkplaceTypeChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Service" }));
  fireEvent.click(screen.getByTitle("Clear Only Show Me filter"));
  expect(onWorkplaceTypeChange.mock.calls).toEqual([[null], [null]]);
});

it("'Only Show Me' is single-select: picking a second option replaces the first", () => {
  const onWorkplaceTypeChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} onWorkplaceTypeChange={onWorkplaceTypeChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Office" }));
  expect(onWorkplaceTypeChange).toHaveBeenCalledWith("OFFICE");
});

it("hides the Following list for a non-MEMBER (anonymous or owner)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.queryByText(/following/i)).not.toBeInTheDocument();
});

it("shows the Following list for a MEMBER; Saved is a feed tab now, not a sidebar button", () => {
  render(<SocialSidebar {...baseProps} isMember={true} />);
  expect(screen.getByText("Following")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /saved/i })).not.toBeInTheDocument();
});

it("picking a Quick Select icon reports the underlying CategoryGroup value", () => {
  const onCategoryGroupChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} onCategoryGroupChange={onCategoryGroupChange} />);
  fireEvent.click(screen.getByRole("radio", { name: "Oil & Energy" }));
  expect(onCategoryGroupChange).toHaveBeenCalledWith("OIL_ENERGY");
});

it("uses the locked SidebarShell geometry (gap-6, not the old gap-5)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  const aside = screen.getByPlaceholderText(/search a company by name/i).closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

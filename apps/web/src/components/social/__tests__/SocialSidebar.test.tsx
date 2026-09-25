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
  savedView: false,
  onToggleSavedView: jest.fn(),
};

beforeEach(() => {
  mockFollowed = { companies: [], loading: false };
  jest.clearAllMocks();
});

it("renders the moved search box and the same Quick Select as the rating/jobs pages (all 7 once opened)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.getByPlaceholderText(/search a company by name/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /quick select/i }));
  for (const label of ["Firms", "Supermarket", "Franchises", "Logistics", "Clothing", "Service Providers", "Oil & Energy"]) {
    expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
  }
});

it("renders 'Only Show Me' as straight pills (Office/Hybrid-Remote/Service/Manual-Labour), not a dropdown", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.queryByRole("button", { name: "Only show me:" })).not.toBeInTheDocument();
  for (const label of ["Office", "Hybrid/Remote", "Service", "Manual-Labour"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
});

it("'Only Show Me' is single-select: picking a second option replaces the first", () => {
  const onWorkplaceTypeChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} onWorkplaceTypeChange={onWorkplaceTypeChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Office" }));
  expect(onWorkplaceTypeChange).toHaveBeenCalledWith("OFFICE");
});

it("hides Following and Saved Posts for a non-MEMBER (anonymous or owner)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.queryByText(/following/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /saved posts/i })).not.toBeInTheDocument();
});

it("shows Following + Saved Posts for a MEMBER and toggles the saved view", () => {
  const onToggleSavedView = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={true} onToggleSavedView={onToggleSavedView} />);
  expect(screen.getByText("Following")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /saved posts/i }));
  expect(onToggleSavedView).toHaveBeenCalledTimes(1);
});

it("picking a Quick Select icon reports the underlying CategoryGroup value", () => {
  const onCategoryGroupChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} onCategoryGroupChange={onCategoryGroupChange} />);
  fireEvent.click(screen.getByRole("button", { name: /quick select/i }));
  fireEvent.click(screen.getByRole("radio", { name: "Oil & Energy" }));
  expect(onCategoryGroupChange).toHaveBeenCalledWith("OIL_ENERGY");
});

it("uses the locked SidebarShell geometry (gap-6, not the old gap-5)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  const aside = screen.getByPlaceholderText(/search a company by name/i).closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

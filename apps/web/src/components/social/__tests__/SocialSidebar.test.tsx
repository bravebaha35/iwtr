import { render, screen, fireEvent } from "@testing-library/react";
import { SocialSidebar } from "../SocialSidebar";

let mockFollowed: { companies: unknown[]; loading: boolean };
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));

const baseProps = {
  query: "",
  onQueryChange: jest.fn(),
  workplaceType: null,
  onWorkplaceTypeChange: jest.fn(),
  category: null,
  onCategoryChange: jest.fn(),
  savedView: false,
  onToggleSavedView: jest.fn(),
};

beforeEach(() => {
  mockFollowed = { companies: [], loading: false };
  jest.clearAllMocks();
});

it("renders the moved search box and the 4 quick-select chips + All", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  expect(screen.getByPlaceholderText(/search a company by name/i)).toBeInTheDocument();
  for (const label of ["Supermarkets", "Oil Companies", "Logistics", "Clothing", "All"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
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

it("picking a quick-select chip reports the underlying Company.category value, not the display label", () => {
  const onCategoryChange = jest.fn();
  render(<SocialSidebar {...baseProps} isMember={false} onCategoryChange={onCategoryChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Oil Companies" }));
  expect(onCategoryChange).toHaveBeenCalledWith("Fuel & Energy");
});

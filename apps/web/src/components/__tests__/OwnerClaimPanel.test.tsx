import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerClaimPanel } from "../OwnerClaimPanel";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn(), apiPost: jest.fn() };
});
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, onboardingStatus: { status: "ACTIVE" } }),
}));

const get = apiClient.apiGet as jest.Mock;
const post = apiClient.apiPost as jest.Mock;

beforeEach(() => {
  get.mockReset().mockResolvedValue([]);
  post.mockReset();
});

test("shows nothing on a company that already has an owner", () => {
  const { container } = render(<OwnerClaimPanel companySlug="acme" hasApprovedOwner />);
  expect(container).toBeEmptyDOMElement();
});

test("won't send a claim without a legal name, and sends the owner's tick-box choice", async () => {
  post.mockResolvedValue({ claimStatus: "PENDING", companySlug: "acme" });
  render(<OwnerClaimPanel companySlug="acme" hasApprovedOwner={false} />);

  await userEvent.click(await screen.findByRole("button", { name: "Claim this company" }));
  await userEvent.click(screen.getByRole("button", { name: "Submit claim" }));
  expect(await screen.findByText(/real first and last name/)).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText("First name"), "Ayşe");
  await userEvent.type(screen.getByLabelText("Last name"), "Demir");
  await userEvent.click(screen.getByRole("button", { name: "Submit claim" }));
  expect(post).toHaveBeenCalledWith("/companies/acme/claim", {
    message: undefined,
    firstName: "Ayşe",
    lastName: "Demir",
    showNameInMessages: false,
  });
  expect(await screen.findByText(/waiting for admin review/)).toBeInTheDocument();
});

test("sends showNameInMessages: true when the box is ticked", async () => {
  post.mockResolvedValue({ claimStatus: "PENDING", companySlug: "acme" });
  render(<OwnerClaimPanel companySlug="acme" hasApprovedOwner={false} />);
  await userEvent.click(await screen.findByRole("button", { name: "Claim this company" }));
  await userEvent.type(screen.getByLabelText("First name"), "Ayşe");
  await userEvent.type(screen.getByLabelText("Last name"), "Demir");
  await userEvent.click(screen.getByRole("checkbox", { name: /Show company owner's name during messaging/ }));
  await userEvent.click(screen.getByRole("button", { name: "Submit claim" }));
  expect(post).toHaveBeenCalledWith("/companies/acme/claim", expect.objectContaining({ showNameInMessages: true }));
});

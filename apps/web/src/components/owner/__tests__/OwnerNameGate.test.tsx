import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerNameGate } from "../OwnerNameGate";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn(), apiPatch: jest.fn() };
});

const refreshOnboardingStatus = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ refreshOnboardingStatus }) }));

const get = apiClient.apiGet as jest.Mock;
const patch = apiClient.apiPatch as jest.Mock;

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

test("shows the dashboard straight away for an owner who has a name", async () => {
  get.mockResolvedValue({ firstName: "Ahmet", lastName: "Yılmaz" });
  render(<OwnerNameGate>dashboard</OwnerNameGate>);
  expect(await screen.findByText("dashboard")).toBeInTheDocument();
});

test("asks a nameless owner for their name before showing the dashboard", async () => {
  get.mockResolvedValue({ firstName: null, lastName: null });
  patch.mockResolvedValue({});
  render(<OwnerNameGate>dashboard</OwnerNameGate>);

  await screen.findByText("Add your name to continue");
  expect(screen.queryByText("dashboard")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(await screen.findByText(/real first and last name/)).toBeInTheDocument();
  expect(patch).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText("First name"), "Ayşe");
  await userEvent.type(screen.getByLabelText("Last name"), "Demir");
  await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  expect(await screen.findByText("dashboard")).toBeInTheDocument();
  expect(patch).toHaveBeenCalledWith("/me/employer-profile", { firstName: "Ayşe", lastName: "Demir" });
});

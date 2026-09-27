import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerNameInMessagesToggle } from "../OwnerNameInMessagesToggle";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn(), apiPatch: jest.fn() };
});

const get = apiClient.apiGet as jest.Mock;
const patch = apiClient.apiPatch as jest.Mock;
const COMPANY = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

test("starts unticked and saves the owner's choice straight away", async () => {
  get.mockResolvedValue({ showNameInMessages: false, ownerName: "Ahmet Yılmaz" });
  patch.mockResolvedValue({ showNameInMessages: true, ownerName: "Ahmet Yılmaz" });
  render(<OwnerNameInMessagesToggle companyId={COMPANY} />);

  const box = await screen.findByRole("checkbox", { name: /Show company owner's name during messaging/ });
  expect(get).toHaveBeenCalledWith(`/my-companies/${COMPANY}/messaging-name`);
  await screen.findByText(/will see "Ahmet Yılmaz"/);
  expect(box).not.toBeChecked();

  await userEvent.click(box);
  expect(patch).toHaveBeenCalledWith(`/my-companies/${COMPANY}/messaging-name`, { showNameInMessages: true });
  expect(await screen.findByText("Saved.")).toBeInTheDocument();
  expect(box).toBeChecked();
});

test("tells an owner without a profile name how to show one", async () => {
  get.mockResolvedValue({ showNameInMessages: false, ownerName: null });
  render(<OwnerNameInMessagesToggle companyId={COMPANY} />);
  expect(await screen.findByText(/add your first and last name in Edit Profile/)).toBeInTheDocument();
});

import { render, screen } from "@testing-library/react";
import { OwnerNameInMessagesNote } from "../OwnerNameInMessagesNote";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn() };
});

const get = apiClient.apiGet as jest.Mock;

test("is always ticked and locked, and names the owner", async () => {
  get.mockResolvedValue({ firstName: "Ahmet", lastName: "Yılmaz" });
  render(<OwnerNameInMessagesNote />);

  const box = screen.getByRole("checkbox", { name: /Show company owner's name during messaging/ });
  expect(box).toBeChecked();
  expect(box).toBeDisabled();
  expect(await screen.findByText(/"Ahmet Yılmaz"/)).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith("/me/employer-profile");
});

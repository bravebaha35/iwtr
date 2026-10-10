import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarPhotoUploader } from "../AvatarPhotoUploader";
import { apiPatch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiPatch: jest.fn(),
  apiUpload: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const patch = apiPatch as jest.Mock;

beforeEach(() => patch.mockReset());

it("shows no remove button while the owner has no photo", () => {
  render(<AvatarPhotoUploader value={null} onChange={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
});

it("removes the photo with the X and hands back null so the avatar returns", async () => {
  patch.mockResolvedValue({});
  const onChange = jest.fn();
  render(<AvatarPhotoUploader value="https://example.test/p.jpg" onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  expect(patch).toHaveBeenCalledWith("/me/employer-profile", { profilePictureUrl: null });
  expect(onChange).toHaveBeenCalledWith(null);
});

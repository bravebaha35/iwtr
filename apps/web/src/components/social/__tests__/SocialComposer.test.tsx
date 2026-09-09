import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialComposer } from "../SocialComposer";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

beforeEach(() => {
  jest.clearAllMocks();
});

const companies = [{ companyId: "c1", companyName: "Acme", companySlug: "acme", tier: "FREE", planStatus: "NONE", isVerifiedBadge: false }];

it("rejects a non-image file with the shared validator message", async () => {
  render(<SocialComposer companies={companies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  const input = screen.getByLabelText(/add a photo/i);
  fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
  expect(await screen.findByText(/must be a JPEG, PNG, or HEIC/i)).toBeInTheDocument();
});

it("uploads via apiUpload with companyId + caption + one file under 'files'", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/add a photo/i), {
    target: { files: [new File(["img"], "a.jpg", { type: "image/jpeg" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("Tell us what you think !"), { target: { value: "new gear" } });
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("companyId")).toBe("c1");
  expect(fd.get("caption")).toBe("new gear");
  expect(fd.get("files")).toBeInstanceOf(File);
});

it("picking multiple photos appends every one under 'files', Instagram-style", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/add a photo/i), {
    target: {
      files: [
        new File(["a"], "a.jpg", { type: "image/jpeg" }),
        new File(["b"], "b.jpg", { type: "image/jpeg" }),
        new File(["c"], "c.jpg", { type: "image/jpeg" }),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.getAll("files")).toHaveLength(3);
});

it("rejects posting with no photo attached at all", async () => {
  render(<SocialComposer companies={companies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  expect(await screen.findByText(/add at least one photo/i)).toBeInTheDocument();
});

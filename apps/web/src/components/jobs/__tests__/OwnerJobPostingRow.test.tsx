import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { JobPostingsCategory } from "@/components/owner/sections/JobPostingsCategory";
import { apiGet, apiPatch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const get = apiGet as jest.Mock;
const patch = apiPatch as jest.Mock;

const posting = (over: Partial<OwnerJobPosting>): OwnerJobPosting => ({
  id: "p",
  companyId: "c1",
  jobTitle: "Job",
  description: "old description",
  workType: "MANUAL_LABOUR",
  status: "PUBLISHED",
  boostDurationDays: null,
  boostExpiresAt: null,
  createdAt: new Date().toISOString(),
  daysRemaining: 20,
  ...over,
});

const list = [
  posting({ id: "1", jobTitle: "Filled role", status: "FILLED", daysRemaining: 0 }),
  posting({ id: "2", jobTitle: "Forklift Operatörü" }),
  posting({ id: "3", jobTitle: "Expired role", daysRemaining: 0 }),
  posting({ id: "4", jobTitle: "Depo Sorumlusu" }),
];

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith("/boost-status")
        ? { tierKey: "starter", freeBoostsRemaining: 2, pricing: [{ durationDays: 7, priceTry: "299.99" }] }
        : list,
    ),
  );
});

const titles = () => screen.getAllByText(/role|Operatörü|Sorumlusu/).map((el) => el.textContent);

it("lists active postings first (green dot), then inactive ones (red dot)", async () => {
  render(<JobPostingsCategory companyId="c1" />);
  await screen.findByText("Forklift Operatörü");
  expect(titles()).toEqual(["Forklift Operatörü", "Depo Sorumlusu", "Filled role", "Expired role"]);
  expect(screen.getAllByRole("img", { name: "Active" })).toHaveLength(2);
  expect(screen.getAllByRole("img", { name: "Inactive" })).toHaveLength(2);
});

it("puts Edit just before Remove, on active postings only", async () => {
  render(<JobPostingsCategory companyId="c1" />);
  const edits = await screen.findAllByRole("button", { name: "Edit" });
  expect(edits).toHaveLength(2);
  const remove = screen.getAllByRole("button", { name: "Remove" })[0];
  expect(edits[0].nextElementSibling).toBe(remove);
});

it("Edit keeps the job title fixed and saves a new description and a free boost", async () => {
  patch.mockResolvedValue({ status: "PUBLISHED", jobPosting: { ...list[1], boostExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString() } });
  const user = userEvent.setup();
  render(<JobPostingsCategory companyId="c1" />);
  await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
  const dialog = screen.getByRole("dialog", { name: "Edit Forklift Operatörü" });
  expect(within(dialog).queryByRole("textbox", { name: /looking for/i })).not.toBeInTheDocument();
  expect(within(dialog).getByText("Can't be changed")).toBeInTheDocument();
  const description = within(dialog).getByLabelText("Description");
  await user.clear(description);
  await user.type(description, "new description");
  await user.click(await within(dialog).findByRole("button", { name: /Boost your job posting for 7 days/ }));
  await user.click(within(dialog).getByRole("button", { name: "Save and boost" }));
  expect(patch).toHaveBeenCalledWith("/my-companies/c1/job-postings/2", {
    description: "new description",
    boost: { durationDays: 7, billing: undefined },
  });
  expect(await within(dialog).findByText(/now featured at the top of the Jobs page/)).toBeInTheDocument();
});

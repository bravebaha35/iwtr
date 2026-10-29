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
  positions: [],
  jobTitle: "Job",
  description: "old description",
  workType: "MANUAL_LABOUR",
  status: "PUBLISHED",
  boostDurationDays: null,
  boostExpiresAt: null,
  boostAdSpace: false,
  salary: null,
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
        ? { tierKey: "starter", freeBoostsRemaining: 2, pricing: [{ option: "FEATURED_7", durationDays: 7, priceTry: "299.99" }] }
        : list,
    ),
  );
});

const titles = () => screen.getAllByText(/role|Operatörü|Sorumlusu/).map((el) => el.textContent);

it("lists active postings first (green dot), then inactive ones (red dot)", async () => {
  render(<JobPostingsCategory companyId="c1" freeAdsLeft={2} planIncludes="5 free ads a month" />);
  await screen.findByText("Forklift Operatörü");
  expect(titles()).toEqual(["Forklift Operatörü", "Depo Sorumlusu", "Filled role", "Expired role"]);
  expect(screen.getAllByRole("img", { name: "Active" })).toHaveLength(2);
  expect(screen.getAllByRole("img", { name: "Inactive" })).toHaveLength(2);
});

it("puts Edit just before Remove, on active postings only", async () => {
  render(<JobPostingsCategory companyId="c1" freeAdsLeft={2} planIncludes="5 free ads a month" />);
  const edits = await screen.findAllByRole("button", { name: "Edit" });
  expect(edits).toHaveLength(2);
  const remove = screen.getAllByRole("button", { name: "Remove" })[0];
  expect(edits[0].nextElementSibling).toBe(remove);
});

it("Edit keeps the job title fixed and saves a new description and a free boost", async () => {
  patch.mockResolvedValue({ status: "PUBLISHED", jobPosting: { ...list[1], boostExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString() } });
  const user = userEvent.setup();
  render(<JobPostingsCategory companyId="c1" freeAdsLeft={2} planIncludes="5 free ads a month" />);
  await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
  const dialog = screen.getByRole("dialog", { name: "Edit Forklift Operatörü" });
  expect(within(dialog).queryByRole("textbox", { name: /looking for/i })).not.toBeInTheDocument();
  expect(within(dialog).getByText("Can't be changed")).toBeInTheDocument();
  const description = within(dialog).getByRole("textbox", { name: "Description" });
  await user.clear(description);
  await user.type(description, "new description");
  await user.click(await within(dialog).findByRole("button", { name: /Boost your job posting for 7 days/ }));
  await user.click(within(dialog).getByRole("button", { name: "Save and boost" }));
  expect(patch).toHaveBeenCalledWith("/my-companies/c1/job-postings/2", {
    description: "new description",
    boost: { option: "FEATURED_7", billing: undefined },
  });
  expect(await within(dialog).findByText(/now featured at the top of the Jobs page/)).toBeInTheDocument();
});

it("Edit changes the positions: shows the saved ones ticked and sends only the new set", async () => {
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith("/boost-status")
        ? { tierKey: "starter", freeBoostsRemaining: 2, pricing: [] }
        : [posting({ id: "2", jobTitle: "Forklift Operatörü", positions: ["INTERN"] })],
    ),
  );
  patch.mockResolvedValue({ status: "PUBLISHED", jobPosting: posting({ id: "2", positions: ["SPECIALIST"] }) });
  const user = userEvent.setup();
  render(<JobPostingsCategory companyId="c1" freeAdsLeft={2} planIncludes="5 free ads a month" />);
  await user.click(await screen.findByRole("button", { name: "Edit" }));
  const dialog = screen.getByRole("dialog", { name: "Edit Forklift Operatörü" });
  const save = within(dialog).getByRole("button", { name: "Save changes" });
  expect(within(dialog).getByRole("checkbox", { name: "Intern" })).toBeChecked();
  expect(save).toBeDisabled();

  await user.click(within(dialog).getByRole("checkbox", { name: "Intern" }));
  expect(within(dialog).getByText("Tick at least one position.")).toBeInTheDocument();
  expect(save).toBeDisabled();

  await user.click(within(dialog).getByRole("checkbox", { name: "Specialist" }));
  await user.click(save);
  expect(patch).toHaveBeenCalledWith("/my-companies/c1/job-postings/2", { positions: ["SPECIALIST"] });
  expect(await within(dialog).findByText("Changes saved")).toBeInTheDocument();
});

it("says in bold how many free featured ads are left, and holds the line's space while that is not known", async () => {
  const { rerender } = render(<JobPostingsCategory companyId="c1" freeAdsLeft={null} planIncludes="5 free ads a month" />);
  await screen.findByText("Forklift Operatörü");
  expect(screen.queryByText(/free ads? left this month/)).not.toBeInTheDocument();

  rerender(<JobPostingsCategory companyId="c1" freeAdsLeft={1} planIncludes="5 free ads a month" />);
  expect(screen.getByText("1 free ad left this month")).toHaveClass("font-bold");
  expect(screen.getByText(/Featured job ads on your plan: 5 free ads a month\./)).toBeInTheDocument();
});

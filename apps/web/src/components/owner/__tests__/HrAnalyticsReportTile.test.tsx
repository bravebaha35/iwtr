import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HrReportAllowance, HrReportJob, HrReportOverview } from "@iwtr/shared-types";
import { HrAnalyticsReportTile } from "../HrAnalyticsReportTile";
import { apiGet, apiPost } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  ApiError: class ApiError extends Error {},
}));
jest.mock("@/components/IyzicoCheckoutEmbed", () => ({
  IyzicoCheckoutEmbed: ({ checkoutFormContent }: { checkoutFormContent: string }) => <div data-testid="iyzico">{checkoutFormContent}</div>,
}));

const COMPANY = "11111111-1111-4111-8111-111111111111";
const get = apiGet as jest.Mock;
const post = apiPost as jest.Mock;

function allowance(overrides: Partial<HrReportAllowance>): HrReportAllowance {
  return { mode: "INCLUDED", quotaRemaining: null, quotaResetsOn: null, priceTry: "199.99", eligible: true, ineligibleReason: null, ...overrides };
}

function job(overrides: Partial<HrReportJob>): HrReportJob {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status: "READY",
    access: "MONTHLY_QUOTA",
    createdAt: "2026-10-03T10:00:00.000Z",
    completedAt: "2026-10-03T10:00:05.000Z",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    errorMessage: null,
    ...overrides,
  };
}

function serve(overview: HrReportOverview) {
  get.mockResolvedValue(overview);
}

afterEach(() => jest.clearAllMocks());

it("tells a Pro owner their monthly report is left and generates it without payment", async () => {
  get
    .mockResolvedValueOnce({ allowance: allowance({ mode: "MONTHLY_QUOTA", quotaRemaining: 1, quotaResetsOn: "2026-11-01" }), jobs: [] })
    .mockResolvedValue({ allowance: allowance({ mode: "PAYMENT_REQUIRED", quotaRemaining: 0, quotaResetsOn: "2026-11-01" }), jobs: [job({ status: "QUEUED" })] });
  post.mockResolvedValue({ status: "QUEUED", job: job({ status: "QUEUED" }) });
  render(<HrAnalyticsReportTile companyId={COMPANY} />);
  expect(await screen.findByText(/You have 1 left this month/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Generate Report" }));
  expect(post).toHaveBeenCalledWith(`/my-companies/${COMPANY}/hr-analytics-report`, {});
  expect(await screen.findByText(/Gathering your reviewers' answers/)).toBeInTheDocument();
});

it("asks a Starter owner to pay 199,99₺, collecting billing details before opening iyzico", async () => {
  serve({ allowance: allowance({ mode: "PAYMENT_REQUIRED" }), jobs: [] });
  post.mockResolvedValue({ status: "CHECKOUT_REQUIRED", job: job({ status: "AWAITING_PAYMENT", access: "PAID" }), checkoutFormContent: "iyzico-form" });
  render(<HrAnalyticsReportTile companyId={COMPANY} />);
  await userEvent.click(await screen.findByRole("button", { name: "Buy report for 199,99₺" }));

  const pay = screen.getByRole("button", { name: "Pay 199,99₺" });
  expect(pay).toBeDisabled();
  await userEvent.type(screen.getByLabelText("First name"), "Ayşe");
  await userEvent.type(screen.getByLabelText("Last name"), "Yılmaz");
  await userEvent.type(screen.getByLabelText(/T.C. Kimlik No/), "12345678901");
  await userEvent.type(screen.getByLabelText("Billing email"), "ayse@example.com");
  await userEvent.type(screen.getByLabelText("City"), "İstanbul");
  await userEvent.type(screen.getByLabelText("Billing address"), "Moda Cd. 1");
  await userEvent.click(pay);

  expect(post).toHaveBeenCalledWith(
    `/my-companies/${COMPANY}/hr-analytics-report`,
    expect.objectContaining({ billing: expect.objectContaining({ buyerIdentityNumber: "12345678901" }) }),
  );
  expect(await screen.findByTestId("iyzico")).toHaveTextContent("iyzico-form");
});

it("tells a Pro owner who used this month's report when it comes back", async () => {
  serve({ allowance: allowance({ mode: "PAYMENT_REQUIRED", quotaRemaining: 0, quotaResetsOn: "2026-11-01" }), jobs: [] });
  render(<HrAnalyticsReportTile companyId={COMPANY} />);
  expect(await screen.findByText(/used this month's report/)).toHaveTextContent("1 November");
});

it("explains and disables the button when there aren't enough reviews yet", async () => {
  serve({ allowance: allowance({ eligible: false, ineligibleReason: "Needs at least 3 published reviews." }), jobs: [] });
  render(<HrAnalyticsReportTile companyId={COMPANY} />);
  expect(await screen.findByText("Needs at least 3 published reviews.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Report" })).toBeDisabled();
});

it("links a ready report to its download through the auth proxy", async () => {
  serve({ allowance: allowance({}), jobs: [job({})] });
  render(<HrAnalyticsReportTile companyId={COMPANY} />);
  const link = await screen.findByRole("link", { name: "Open PDF" });
  expect(link).toHaveAttribute("href", `/api/proxy/my-companies/${COMPANY}/hr-analytics-report/${job({}).id}/download`);
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
});

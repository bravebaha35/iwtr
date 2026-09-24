import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BenchmarkReportJob } from "@iwtr/shared-types";
import { SectorBenchmarkTile } from "../SectorBenchmarkTile";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { NOTIFICATIONS_STALE_EVENT } from "@/lib/notification-events";

jest.mock("@/lib/api-client", () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const COMPANY = "11111111-1111-4111-8111-111111111111";

function job(overrides: Partial<BenchmarkReportJob>): BenchmarkReportJob {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status: "READY",
    sectorCategory: "Supermarket",
    city: null,
    createdAt: "2026-09-24T10:00:00.000Z",
    completedAt: "2026-09-24T10:00:05.000Z",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    errorMessage: null,
    ...overrides,
  };
}

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it("shows an upsell and makes no API call below Enterprise", () => {
  render(<SectorBenchmarkTile companyId={COMPANY} isEnterprise={false} />);
  expect(screen.getByText(/Available on the Enterprise plan/)).toBeInTheDocument();
  expect(apiGet).not.toHaveBeenCalled();
});

it("links a READY report to its download route through the auth proxy", async () => {
  (apiGet as jest.Mock).mockResolvedValue([job({})]);
  render(<SectorBenchmarkTile companyId={COMPANY} isEnterprise />);
  expect(await screen.findByRole("link", { name: "Open PDF" })).toHaveAttribute(
    "href",
    `/api/proxy/my-companies/${COMPANY}/sector-benchmark/22222222-2222-4222-8222-222222222222/download`,
  );
});

it("queues a report, shows a progress bar while it builds, and tells the bell when it's ready", async () => {
  jest.useFakeTimers();
  (apiGet as jest.Mock).mockResolvedValueOnce([]);
  (apiPost as jest.Mock).mockResolvedValue(job({ status: "QUEUED", completedAt: null, expiresAt: null }));
  const bell = jest.fn();
  window.addEventListener(NOTIFICATIONS_STALE_EVENT, bell);

  render(<SectorBenchmarkTile companyId={COMPANY} isEnterprise />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("radio", { name: "My company's city" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate report" }));

  await waitFor(() => expect(apiPost).toHaveBeenCalledWith(`/my-companies/${COMPANY}/sector-benchmark`, { scope: "CITY" }));
  expect(await screen.findByRole("progressbar", { name: "Generating report" })).toBeInTheDocument();

  (apiGet as jest.Mock).mockResolvedValue([job({})]);
  await act(async () => {
    jest.advanceTimersByTime(3_000);
  });

  expect(await screen.findByRole("link", { name: "Open PDF" })).toBeInTheDocument();
  expect(bell).toHaveBeenCalledTimes(1);
  window.removeEventListener(NOTIFICATIONS_STALE_EVENT, bell);
});

it("explains the anonymity lock in plain words on a FAILED report", async () => {
  (apiGet as jest.Mock).mockResolvedValue([
    job({ status: "FAILED", errorMessage: "Insufficient Data to Ensure Anonymity", expiresAt: null }),
  ]);
  render(<SectorBenchmarkTile companyId={COMPANY} isEnterprise />);
  expect(await screen.findByText(/Not enough companies in your sector have reviews yet/)).toBeInTheDocument();
  expect(screen.queryByText("Insufficient Data to Ensure Anonymity")).not.toBeInTheDocument();
});

it("explains a refused request (anonymity lock) in plain words", async () => {
  (apiGet as jest.Mock).mockResolvedValue([]);
  (apiPost as jest.Mock).mockRejectedValue(new ApiError("Insufficient Data to Ensure Anonymity", 403, null));
  render(<SectorBenchmarkTile companyId={COMPANY} isEnterprise />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
  expect(await screen.findByText(/at least 5 different reviewers from at least 3 different companies/)).toBeInTheDocument();
});

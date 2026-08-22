import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompanyDetail, MyCompanyClaim } from "@iwtr/shared-types";
import MyCompaniesPage from "../page";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return {
    ...actual,
    apiGet: jest.fn(),
    apiPost: jest.fn(),
    apiPatch: jest.fn(),
    apiUpload: jest.fn(),
  };
});

import { apiGet, apiPatch } from "@/lib/api-client";

const claim: MyCompanyClaim = {
  id: "claim-1",
  companyId: "company-1",
  companyName: "Acme Corp",
  companySlug: "acme-corp",
  tier: "FREE",
  planStatus: "NONE",
  isVerifiedBadge: false,
  claimStatus: "APPROVED",
  createdAt: new Date().toISOString(),
  resolvedAt: null,
};

const detail: CompanyDetail = {
  company: {
    id: "company-1",
    slug: "acme-corp",
    name: "Acme Corp",
    category: "Software",
    workplaceTypes: ["OFFICE"],
    mainPhotoUrl: null,
    description: null,
    website: null,
    city: "Istanbul",
    district: "Kadikoy",
    isVerifiedBadge: false,
    contactEmail: "contact@acme.test",
    contactPhone: "+902121234567",
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    xUrl: null,
  },
  aggregate: null,
};

function mockApiGet() {
  (apiGet as jest.Mock).mockImplementation((path: string) => {
    if (path === "/me/company-claims") return Promise.resolve([claim]);
    if (path === `/companies/${claim.companySlug}`) return Promise.resolve(detail);
    if (path === `/companies/${claim.companySlug}/reviews`) return Promise.resolve([]);
    return Promise.reject(new Error(`Unhandled apiGet path in test: ${path}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet();
});

async function renderLoadedPage() {
  render(<MyCompaniesPage />);
  await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
}

test("renders exactly three dashboard boxes with the required headers", async () => {
  await renderLoadedPage();

  const headings = screen.getAllByRole("heading", { level: 3 });
  expect(headings.map((h) => h.textContent)).toEqual([
    "General Information",
    "Contact & Social Media",
    "Reviews & Ratings",
  ]);
});

test("General Information box holds both company-basics and location fields", async () => {
  await renderLoadedPage();

  const box = screen.getByRole("heading", { name: "General Information" }).parentElement as HTMLElement;
  expect(within(box).getByLabelText(/Company name/i)).toBeInTheDocument();
  expect(within(box).getByText("Location")).toBeInTheDocument();
});

test("Contact & Social Media box shows the exact KVKK contact-number notice", async () => {
  await renderLoadedPage();

  const box = screen.getByRole("heading", { name: "Contact & Social Media" }).parentElement as HTMLElement;
  expect(within(box).getByText("Notice on Contact Numbers:")).toBeInTheDocument();
  expect(
    within(box).getByText(
      /you may register using your personal or primary mobile number/,
    ),
  ).toBeInTheDocument();
});

test("page keeps exactly two ad slots (no four-corner ads)", async () => {
  await renderLoadedPage();

  expect(screen.getAllByText("Ad space")).toHaveLength(2);
});

test("saving General Information sends the changed fields in one request", async () => {
  const user = userEvent.setup();
  (apiPatch as jest.Mock).mockResolvedValue(undefined);
  await renderLoadedPage();

  const box = screen.getByRole("heading", { name: "General Information" }).parentElement as HTMLElement;
  const nameInput = within(box).getByLabelText(/Company name/i);
  await user.clear(nameInput);
  await user.type(nameInput, "New Acme Name");
  await user.click(within(box).getByRole("button", { name: "Save changes" }));

  await waitFor(() =>
    expect(apiPatch).toHaveBeenCalledWith(
      `/my-companies/${claim.companyId}`,
      expect.objectContaining({ name: "New Acme Name" }),
    ),
  );
});

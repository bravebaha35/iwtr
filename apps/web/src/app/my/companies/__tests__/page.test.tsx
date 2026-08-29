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
  rivalAnalyticsTier: null,
  rivalAnalyticsFreeRequestUsed: false,
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
  // "Acme Corp" itself renders from the claims list (a separate, earlier
  // fetch than the card's own company-detail load) — wait on a field that
  // only gets its value from that second fetch, so every test starts from
  // a fully-hydrated card, not a half-loaded one.
  await waitFor(() => expect(screen.getByLabelText(/^Email/i)).toHaveValue(detail.company.contactEmail));
}

test("renders exactly three dashboard boxes with the required headers, in order", async () => {
  await renderLoadedPage();

  // getByRole throws on more than one match, so each call also confirms
  // that exact header text appears exactly once (not merged/duplicated).
  const general = screen.getByRole("heading", { name: "General Information" });
  const contact = screen.getByRole("heading", { name: "Contact & Social Media" });
  const reviews = screen.getByRole("heading", { name: "Reviews & Ratings" });

  // DOCUMENT_POSITION_FOLLOWING (4) means the second node comes after the
  // first in document order.
  expect(general.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(contact.compareDocumentPosition(reviews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

test("saving Contact & Social Media does not discard an unsaved City pick in General Information", async () => {
  const user = userEvent.setup();
  (apiPatch as jest.Mock).mockResolvedValue(undefined);
  await renderLoadedPage();

  const generalBox = screen.getByRole("heading", { name: "General Information" }).parentElement as HTMLElement;
  const locationRow = within(generalBox).getByText("Location").nextElementSibling as HTMLElement;
  await user.click(within(locationRow).getAllByRole("button")[0]);
  await user.click(within(generalBox).getByRole("button", { name: "Ankara" }));
  expect(within(generalBox).getByRole("button", { name: /^Ankara/ })).toBeInTheDocument();

  const contactBox = screen.getByRole("heading", { name: "Contact & Social Media" }).parentElement as HTMLElement;
  await user.click(within(contactBox).getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(within(contactBox).getByText("Saved.")).toBeInTheDocument());

  expect(within(generalBox).getByRole("button", { name: /^Ankara/ })).toBeInTheDocument();
});

test("picking a 3rd workplace type replaces the selection instead of adding to it", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const box = screen.getByRole("heading", { name: "General Information" }).parentElement as HTMLElement;
  const office = within(box).getByRole("button", { name: "Office" });
  const hybrid = within(box).getByRole("button", { name: "Hybrid/Remote" });
  const service = within(box).getByRole("button", { name: "Service" });

  // Loaded from the mocked company, which starts with workplaceTypes: ["OFFICE"].
  expect(office).toHaveClass("bg-brand-600");

  await user.click(hybrid);
  expect(office).toHaveClass("bg-brand-600");
  expect(hybrid).toHaveClass("bg-brand-600");

  await user.click(service);
  expect(office).not.toHaveClass("bg-brand-600");
  expect(hybrid).not.toHaveClass("bg-brand-600");
  expect(service).toHaveClass("bg-brand-600");
});

test("Sector options narrow to the picked workplace type(s)", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const box = screen.getByRole("heading", { name: "General Information" }).parentElement as HTMLElement;
  // Loaded workplaceTypes is ["OFFICE"] — "Construction" is manual-labour-only.
  await user.click(within(box).getByRole("button", { name: /^Sector/ }));
  expect(within(box).queryByRole("button", { name: "Construction" })).not.toBeInTheDocument();
  expect(within(box).getByRole("button", { name: "Information Technology" })).toBeInTheDocument();
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

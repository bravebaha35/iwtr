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
    structureType: "SETTLED",
    region: null,
    isVerifiedBadge: false,
    badgeTier: "FREE",
    taxNumber: null,
    isChainStore: false,
    isHiring: false,
    contactEmail: "contact@acme.test",
    contactPhone: "+902121234567",
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    xUrl: null,
    linkedinUrl: null,
    youtubeUrl: null,
    glassdoorUrl: null,
    bannerImageUrl: null,
    featuredReviewId: null,
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

// General Information is the default active tab, so waiting on a field only
// the company-detail fetch populates (workplaceTypes, not carried by the
// earlier claims-list fetch) confirms the card is fully hydrated before each
// test interacts with it.
async function renderLoadedPage() {
  render(<MyCompaniesPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Office" })).toHaveClass("bg-brand-600"));
}

function generalInfoBox(): HTMLElement {
  return screen.getByRole("heading", { name: "General Information", level: 3 }).parentElement as HTMLElement;
}

test("side panel lists the three sections in order, and only the active one's content renders", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const nav = screen.getByRole("navigation", { name: "Company dashboard sections" });
  const tabs = within(nav).getAllByRole("button");
  expect(tabs.map((t) => t.textContent)).toEqual(["General Information", "Contact & Social Media", "Reviews & Ratings"]);

  expect(screen.getByRole("heading", { name: "General Information", level: 3 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Contact & Social Media" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Reviews & Ratings" })).not.toBeInTheDocument();

  await user.click(within(nav).getByRole("button", { name: "Contact & Social Media" }));
  expect(screen.getByRole("heading", { name: "Contact & Social Media" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "General Information", level: 3 })).not.toBeInTheDocument();

  await user.click(within(nav).getByRole("button", { name: "Reviews & Ratings" }));
  expect(screen.getByRole("heading", { name: "Reviews & Ratings" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Contact & Social Media" })).not.toBeInTheDocument();
});

test("General Information box holds both company-basics and location fields, plus a live Work Card preview", async () => {
  await renderLoadedPage();

  const box = generalInfoBox();
  expect(within(box).getByLabelText(/Company name/i)).toBeInTheDocument();
  expect(within(box).getByText("Headcount Range / Location")).toBeInTheDocument();
  // "No reviews yet" only ever renders inside the live CompanyWorkCard
  // preview (the mocked company has aggregate: null) — confirms the preview
  // mounted with real data, not a blank shell.
  expect(within(box).getByText("No reviews yet")).toBeInTheDocument();
});

test("Contact & Social Media box shows the exact KVKK contact-number notice", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  await user.click(screen.getByRole("button", { name: "Contact & Social Media" }));
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

  const generalBox = generalInfoBox();
  const locationLabel = within(generalBox).getByText("Headcount Range / Location");
  const locationRow = locationLabel.nextElementSibling as HTMLElement;
  await user.click(within(locationRow).getAllByRole("button")[0]);
  await user.click(screen.getByRole("button", { name: "Ankara" }));
  expect(within(generalBox).getByRole("button", { name: /^Ankara/ })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Contact & Social Media" }));
  const contactBox = screen.getByRole("heading", { name: "Contact & Social Media" }).parentElement as HTMLElement;
  await user.click(within(contactBox).getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(within(contactBox).getByText("Saved.")).toBeInTheDocument());

  await user.click(screen.getByRole("button", { name: "General Information" }));
  expect(within(generalInfoBox()).getByRole("button", { name: /^Ankara/ })).toBeInTheDocument();
});

test("picking a 3rd workplace type replaces the selection instead of adding to it", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const box = generalInfoBox();
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

  const box = generalInfoBox();
  // Loaded workplaceTypes is ["OFFICE"] — "Construction" is manual-labour-only.
  await user.click(within(box).getByRole("button", { name: /^Sector/ }));
  expect(within(box).queryByRole("button", { name: "Construction" })).not.toBeInTheDocument();
  expect(within(box).getByRole("button", { name: "Information Technology (IT)" })).toBeInTheDocument();
});

test("saving General Information sends the changed fields in one request", async () => {
  const user = userEvent.setup();
  (apiPatch as jest.Mock).mockResolvedValue(undefined);
  await renderLoadedPage();

  const box = generalInfoBox();
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

test("Premium Features box is hidden on the Free tier", async () => {
  await renderLoadedPage();

  expect(screen.queryByRole("heading", { name: "Premium Features" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Blue — /})).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Blue\+ — /})).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Enterprise — /})).toBeInTheDocument();
});

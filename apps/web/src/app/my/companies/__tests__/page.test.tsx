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
  hidden: false,
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
    contactEmail2: null,
    contactEmail3: null,
    contactPhone: "+902121234567",
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    xUrl: null,
    linkedinUrl: null,
    youtubeUrl: null,
    glassdoorUrl: null,
    bannerImageUrl: null,
    defaultBannerUrl: "/office-default-banner.webp",
    hasApprovedOwner: true,
    featuredReviewId: null,
    riskScore: 0,
  },
  aggregate: null,
};

function mockApiGet() {
  (apiGet as jest.Mock).mockImplementation((path: string) => {
    if (path === "/me/employer-profile") return Promise.resolve({ firstName: "Ahmet", lastName: "Yılmaz" });
    if (path === "/me/company-claims") return Promise.resolve([claim]);
    if (path === `/companies/${claim.companySlug}`) return Promise.resolve(detail);
    if (path === `/companies/${claim.companySlug}/reviews`) return Promise.resolve([]);
    if (path === `/owner/companies/${claim.companyId}/conversations`) return Promise.resolve([]);
    if (path === "/me/employer-profile") return Promise.resolve({ firstName: "Ahmet", lastName: "Yılmaz" });
    if (path.endsWith("/job-postings")) return Promise.resolve([]);
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
// test interacts with it. The primary work-type dropdown shows the loaded
// company's first work-type ("Office") once that fetch resolves.
async function renderLoadedPage() {
  render(<MyCompaniesPage />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Primary work-type" })).toHaveTextContent("Office"),
  );
}

function generalInfoBox(): HTMLElement {
  return screen.getByRole("heading", { name: "General Information", level: 3 }).parentElement as HTMLElement;
}

test("side panel lists the standard sections, then Premium Features as its own panel", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const nav = screen.getByRole("navigation", { name: "Company dashboard sections" });
  const tabs = within(nav).getAllByRole("button");
  expect(tabs.map((t) => t.textContent)).toEqual([
    "General Information",
    "Contact & Social Media",
    "Reviews & Ratings",
    "Applications",
    "Job Postings",
    "Customer Support & Service Level (SLA)",
  ]);
  expect(screen.getByRole("heading", { name: "Premium Features", level: 2 })).toBeInTheDocument();
  const premium = screen.getByRole("navigation", { name: "Premium features" });
  expect(within(premium).getAllByRole("button").map((t) => t.textContent)).toEqual([
    "Featured Review Spotlight",
    "Benchmark Reports",
    "Posting Featured Job Ads",
    "HR Manager Licenses",
  ]);

  expect(screen.getByRole("heading", { name: "General Information", level: 3 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Contact & Social Media" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Reviews & Ratings" })).not.toBeInTheDocument();

  await user.click(within(nav).getByRole("button", { name: "Contact & Social Media" }));
  expect(screen.getByRole("heading", { name: "Contact & Social Media" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "General Information", level: 3 })).not.toBeInTheDocument();

  await user.click(within(nav).getByRole("button", { name: "Reviews & Ratings" }));
  expect(screen.getByRole("heading", { name: "Ratings", level: 3 })).toBeInTheDocument();
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

test("secondary work-type dropdown excludes the primary, and changing the primary clears a now-invalid secondary", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  const box = generalInfoBox();
  const primary = within(box).getByRole("button", { name: "Primary work-type" });
  const secondary = within(box).getByRole("button", { name: "Secondary work-type" });

  // Loaded company is workplaceTypes: ["OFFICE"] — primary shows it, secondary is empty.
  expect(primary).toHaveTextContent("Office");
  expect(secondary).toHaveTextContent("None");

  // The secondary list never offers the current primary.
  await user.click(secondary);
  expect(within(box).queryByRole("button", { name: "Office" })).not.toBeInTheDocument();
  await user.click(within(box).getByRole("button", { name: "Service" }));
  expect(secondary).toHaveTextContent("Service");

  // Switching the primary to what the secondary holds drops the secondary.
  await user.click(primary);
  await user.click(within(box).getByRole("button", { name: "Service" }));
  expect(primary).toHaveTextContent("Service");
  expect(within(box).getByRole("button", { name: "Secondary work-type" })).toHaveTextContent("None");
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

test("on the Free tier a premium section shows what it does and the plans that unlock it", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  await user.click(screen.getByRole("button", { name: "Featured Review Spotlight" }));
  const locked = screen.getByRole("heading", { name: /Featured Review Spotlight/, level: 3 }).parentElement as HTMLElement;
  expect(within(locked).getByText(/Pin one of your published reviews/)).toBeInTheDocument();
  expect(within(locked).getByRole("button", { name: /^Blue — /})).toBeInTheDocument();
  expect(within(locked).getByRole("button", { name: /^Blue\+ — /})).toBeInTheDocument();
  expect(within(locked).getByRole("button", { name: /^Enterprise — /})).toBeInTheDocument();
});

test("the tier label opens a closeable note about the Verified Employer Badge", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();

  await user.click(screen.getByRole("button", { name: "Free Tier" }));
  const dialog = screen.getByRole("dialog", { name: "Verified Employer Badge" });
  expect(within(dialog).getByText(/appears next to your company name/)).toBeInTheDocument();
  expect(within(dialog).getByText("Grey check-mark")).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Reviews & Ratings shows how many replies are left this month between Ratings and Reviews", async () => {
  const user = userEvent.setup();
  (apiGet as jest.Mock).mockImplementation((path: string) => {
    if (path === "/me/employer-profile") return Promise.resolve({ firstName: "Ahmet", lastName: "Yılmaz" });
    if (path === "/me/company-claims") return Promise.resolve([claim]);
    if (path === `/companies/${claim.companySlug}`) return Promise.resolve(detail);
    if (path.endsWith("/reply-allowance")) {
      return Promise.resolve({ tier: "FREE", limit: 2, usedThisMonth: 1, remaining: 1, resetsOn: "2026-10-01" });
    }
    return Promise.resolve([]);
  });
  await renderLoadedPage();
  await user.click(screen.getByRole("button", { name: "Reviews & Ratings" }));
  const replies = await screen.findByRole("region", { name: "Monthly comment responses" });
  expect(replies).toHaveTextContent("1 of 2 replies left");
  expect(replies).toHaveTextContent("1 October");
});

test("Customer Support shows the plan's support and the message form to the admin", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();
  await user.click(screen.getByRole("button", { name: "Customer Support & Service Level (SLA)" }));
  expect(screen.getByText("Standard mail")).toBeInTheDocument();
  expect(screen.getByLabelText(/Contact the admin/)).toBeInTheDocument();
});


test("an owner of several companies picks one from tabs under the heading", async () => {
  const user = userEvent.setup();
  const second: MyCompanyClaim = { ...claim, id: "claim-2", companyId: "company-2", companyName: "Beta Ltd", companySlug: "beta-ltd" };
  (apiGet as jest.Mock).mockImplementation((path: string) => {
    if (path === "/me/employer-profile") return Promise.resolve({ firstName: "Ahmet", lastName: "Yılmaz" });
    if (path === "/me/company-claims") return Promise.resolve([claim, second]);
    if (path === "/companies/acme-corp") return Promise.resolve(detail);
    if (path === "/companies/beta-ltd") {
      return Promise.resolve({ ...detail, company: { ...detail.company, id: "company-2", slug: "beta-ltd", name: "Beta Ltd" } });
    }
    return Promise.resolve([]);
  });
  render(<MyCompaniesPage />);

  const tabs = await screen.findByRole("navigation", { name: "Your companies" });
  expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual(["Acme Corp", "Beta Ltd"]);
  expect(within(tabs).getByRole("button", { name: "Acme Corp" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Acme Corp" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Beta Ltd" })).not.toBeInTheDocument();

  await user.click(within(tabs).getByRole("button", { name: "Beta Ltd" }));
  expect(await screen.findByRole("link", { name: "Beta Ltd" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Acme Corp" })).not.toBeInTheDocument();
  expect(window.location.search).toContain("company=company-2");
});

test("a single company gets no tab bar", async () => {
  await renderLoadedPage();
  expect(screen.queryByRole("navigation", { name: "Your companies" })).not.toBeInTheDocument();
});

test("Job Postings opens inside the dashboard with plain wording", async () => {
  const user = userEvent.setup();
  await renderLoadedPage();
  await user.click(screen.getByRole("button", { name: "Job Postings" }));
  expect(screen.getByRole("heading", { name: "Job Postings", level: 3 })).toBeInTheDocument();
  expect(screen.getByText(/All the job ads you.ve posted for this company/)).toBeInTheDocument();
  expect(await screen.findByText("You haven't posted any jobs yet.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Post a new job" })).toHaveAttribute("href", "/jobs");
});

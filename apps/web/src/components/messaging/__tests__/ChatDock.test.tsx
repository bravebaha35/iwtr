import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { ChatDock } from "../ChatDock";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn(), apiPost: jest.fn() };
});

let mockRole: "MEMBER" | "COMPANY_OWNER" = "MEMBER";
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, role: mockRole, onboardingStatus: { status: "ACTIVE" } }),
}));

let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));

const id = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;

const summary: ConversationSummary = {
  id: id(1),
  reviewId: id(2),
  counterpartName: "Quiet Beaver",
  companySlug: null,
  companyName: "Demo Finans Holding",
  companyLogoUrl: null,
  reviewerName: "Quiet Beaver",
  reviewerAvatarKey: null,
  reviewerAvatarGradient: null,
  ownerName: null,
  companyReplied: false,
  lastMessagePreview: "Can I explain the shift issue?",
  lastMessageDay: "2026-09-25",
  unread: true,
  ended: false,
  endedBy: null,
};

function thread(overrides: Partial<ConversationThread> = {}): ConversationThread {
  return {
    ...summary,
    unread: false,
    reviewExcerpt: "Managers were fair but the shifts were long.",
    messages: [{ id: id(3), fromMe: false, day: "2026-09-25", content: "Can I explain the shift issue?", sharesPhoneNumber: false }],
    canSend: true,
    cannotSendReason: null,
    ...overrides,
  };
}

const get = apiClient.apiGet as jest.Mock;
const post = apiClient.apiPost as jest.Mock;

function serve(list: ConversationSummary[], threadFor: (path: string) => ConversationThread = () => thread()) {
  get.mockImplementation((path: string) => Promise.resolve(path.endsWith("/conversations") ? list : threadFor(path)));
}

async function openList() {
  await userEvent.click(await screen.findByRole("button", { name: /^Messages/ }));
}

beforeEach(() => {
  mockRole = "MEMBER";
  mockParams = new URLSearchParams();
  window.innerWidth = 1600;
  get.mockReset();
  post.mockReset();
  serve([summary]);
  post.mockResolvedValue(undefined);
});

describe("ChatDock", () => {
  it("loads the owner inbox and opens a conversation panel, marking it read", async () => {
    mockRole = "COMPANY_OWNER";
    render(<ChatDock />);
    await openList();
    await userEvent.click(await screen.findByRole("button", { name: /Quiet Beaver/ }));
    expect(get).toHaveBeenCalledWith("/owner/conversations");
    const panel = await screen.findByRole("region", { name: "Conversation with Demo Finans Holding" });
    expect(await within(panel).findByText("Can I explain the shift issue?", { selector: "p" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(`/conversations/${summary.id}/read`, {});
  });

  it("opens the conversation named in ?openChat= and removes it from the address bar", async () => {
    window.history.replaceState(null, "", `/social?openChat=${summary.id}`);
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    expect(get).toHaveBeenCalledWith("/me/conversations");
    expect(await screen.findByRole("region", { name: "Conversation with Demo Finans Holding" })).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/conversations/${summary.id}`));
    expect(window.location.search).toBe("");
  });

  it("ignores an ?openChat= value that isn't a conversation id", async () => {
    mockParams = new URLSearchParams("openChat=../../admin");
    render(<ChatDock />);
    await screen.findByRole("button", { name: /^Messages/ });
    expect(screen.queryByRole("region", { name: /Conversation with/ })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("admin"));
  });

  it("stacks up to three panels to the left of the Messages tab, closing the oldest past that", async () => {
    const rows = [1, 4, 5, 6].map((n, i) => ({ ...summary, id: id(n), companyName: `Company ${i + 1}` }));
    serve(rows, (path) => {
      const row = rows.find((r) => path.endsWith(r.id))!;
      return thread({ id: row.id, companyName: row.companyName });
    });
    render(<ChatDock />);
    await openList();
    for (const name of ["Company 1", "Company 2", "Company 3", "Company 4"]) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
    }
    await waitFor(() => expect(screen.getAllByRole("region", { name: /Conversation with/ })).toHaveLength(3));
    // Newest sits next to the tab (first after it in DOM order, shown right-to-left).
    const names = screen.getAllByRole("region", { name: /Conversation with/ }).map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual(["Conversation with Company 4", "Conversation with Company 3", "Conversation with Company 2"]);
  });

  it("fits only one panel on a narrow window", async () => {
    window.innerWidth = 800;
    serve([summary, { ...summary, id: id(4), companyName: "Other Co" }], (path) =>
      thread(path.endsWith(id(4)) ? { id: id(4), companyName: "Other Co" } : {}),
    );
    render(<ChatDock />);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: /Demo Finans Holding/ }));
    await userEvent.click(screen.getByRole("button", { name: /Other Co/ }));
    await waitFor(() => expect(screen.getAllByRole("region", { name: /Conversation with/ })).toHaveLength(1));
  });

  it("closes a panel", async () => {
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    const panel = await screen.findByRole("region", { name: "Conversation with Demo Finans Holding" });
    await userEvent.click(within(panel).getByRole("button", { name: "Close conversation" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /Conversation with/ })).not.toBeInTheDocument());
  });

  it("shows message text exactly as typed, never as HTML", async () => {
    const payload = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    serve([summary], () => thread({ messages: [{ id: id(3), fromMe: false, day: "2026-09-25", content: payload, sharesPhoneNumber: false }] }));
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    const { container } = render(<ChatDock />);
    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(container.querySelector("img[src='x'], script")).toBeNull();
  });

  it("keeps nothing in browser storage", async () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    await screen.findByText("Can I explain the shift issue?", { selector: "p" });
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("explains why the reviewer can't write yet", async () => {
    serve([summary], () => thread({ canSend: false, cannotSendReason: "AWAITING_COMPANY" }));
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    expect(await screen.findByText(/wait for .* to answer/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("keeps the draft and shows the reason when a message is blocked", async () => {
    mockRole = "COMPANY_OWNER";
    post.mockImplementation((path: string) =>
      path.endsWith("/messages")
        ? Promise.reject(new apiClient.ApiError("Your message couldn't be sent: PHONE_NUMBER.", 400, null))
        : Promise.resolve(undefined),
    );
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Call 0532 123 45 67");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/couldn't be sent/)).toBeInTheDocument();
    expect(box).toHaveValue("Call 0532 123 45 67");
  });

  it("ends the conversation only after confirming", async () => {
    mockRole = "COMPANY_OWNER";
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    post.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith("/end") ? thread({ ended: true, endedBy: "YOU", canSend: false, cannotSendReason: "ENDED" }) : undefined),
    );
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    await userEvent.click(await screen.findByRole("button", { name: "End conversation" }));
    expect(confirm).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(`/conversations/${summary.id}/end`, {});
    expect(await screen.findByText(/You ended this conversation/)).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows the company the reviewer's review name, and the unread count on the tab", async () => {
    mockRole = "COMPANY_OWNER";
    render(<ChatDock />);
    expect(await screen.findByRole("button", { name: /^Messages 1 unread/ })).toBeInTheDocument();
    await openList();
    const row = await screen.findByRole("button", { name: /Demo Finans Holding/ });
    expect(row).toHaveTextContent("Active");
    expect(row).toHaveTextContent("Quiet Beaver");
  });

  it("shows the reviewer no name before the company replies, then the owner's name or 'Company representative'", async () => {
    serve([
      summary,
      { ...summary, id: id(4), ended: true, ownerName: "Ahmet Yılmaz", companyReplied: true },
      { ...summary, id: id(5), companyReplied: true },
    ]);
    render(<ChatDock />);
    await openList();
    const rows = await screen.findAllByRole("button", { name: /Demo Finans Holding/ });
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[0]).not.toHaveTextContent("Company representative");
    expect(rows[0]).not.toHaveTextContent("Quiet Beaver");
    expect(rows[1]).toHaveTextContent("Ended");
    expect(rows[1]).toHaveTextContent("Ahmet Yılmaz");
    expect(rows[2]).toHaveTextContent("Company representative");
  });

  it("warns under a message that shares a phone number, and while one is being typed", async () => {
    serve([summary], () =>
      thread({ messages: [{ id: id(4), fromMe: false, day: "2026-09-25", content: "My number is 0532 123 45 67", sharesPhoneNumber: true }] }),
    );
    mockParams = new URLSearchParams(`openChat=${summary.id}`);
    render(<ChatDock />);
    expect(await screen.findAllByText(/Be careful while sharing your phone number/)).toHaveLength(1);
    await userEvent.type(screen.getByLabelText("Your message"), "mine is 0533 765 43 21");
    expect(screen.getAllByText(/Be careful while sharing your phone number/)).toHaveLength(2);
  });

  it("shows an empty state when there are no conversations", async () => {
    serve([]);
    render(<ChatDock />);
    await openList();
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });
});

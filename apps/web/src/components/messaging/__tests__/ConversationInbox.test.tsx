import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { ConversationInbox } from "../ConversationInbox";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn(), apiPost: jest.fn() };
});

const summary: ConversationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  reviewId: "22222222-2222-4222-8222-222222222222",
  counterpartName: "Quiet Beaver",
  companySlug: null,
  companyName: "Demo Finans Holding",
  companyLogoUrl: null,
  reviewerName: "Quiet Beaver",
  reviewerAvatarKey: null,
  reviewerAvatarGradient: null,
  ownerName: null,
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
    messages: [{ id: "33333333-3333-4333-8333-333333333333", fromMe: false, day: "2026-09-25", content: "Can I explain the shift issue?", sharesPhoneNumber: false }],
    canSend: true,
    cannotSendReason: null,
    ...overrides,
  };
}

const get = apiClient.apiGet as jest.Mock;
const post = apiClient.apiPost as jest.Mock;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((path: string) =>
    Promise.resolve(path.endsWith("/conversations") ? [summary] : thread()),
  );
  post.mockResolvedValue(undefined);
});

describe("ConversationInbox", () => {
  it("loads the owner inbox and opens a conversation, marking it read", async () => {
    render(<ConversationInbox mode="company" />);
    await userEvent.click(await screen.findByRole("button", { name: /Quiet Beaver/ }));
    expect(get).toHaveBeenCalledWith("/owner/conversations");
    expect(await screen.findByText("Can I explain the shift issue?", { selector: "p" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(`/conversations/${summary.id}/read`, {});
  });

  it("opens the conversation named in the link straight away", async () => {
    render(<ConversationInbox mode="reviewer" initialConversationId={summary.id} />);
    expect(get).toHaveBeenCalledWith("/me/conversations");
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/conversations/${summary.id}`));
  });

  it("explains why the reviewer can't write yet", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/conversations") ? [summary] : thread({ canSend: false, cannotSendReason: "AWAITING_COMPANY" }),
      ),
    );
    render(<ConversationInbox mode="reviewer" initialConversationId={summary.id} />);
    expect(await screen.findByText(/wait for .* to answer/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("keeps the draft and shows the reason when a message is blocked", async () => {
    post.mockImplementation((path: string) =>
      path.endsWith("/messages")
        ? Promise.reject(new apiClient.ApiError("Your message couldn't be sent: PHONE_NUMBER.", 400, null))
        : Promise.resolve(undefined),
    );
    render(<ConversationInbox mode="company" initialConversationId={summary.id} />);
    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Call 0532 123 45 67");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/couldn't be sent/)).toBeInTheDocument();
    expect(box).toHaveValue("Call 0532 123 45 67");
  });

  it("ends the conversation only after confirming", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    post.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith("/end") ? thread({ ended: true, endedBy: "YOU", canSend: false, cannotSendReason: "ENDED" }) : undefined),
    );
    render(<ConversationInbox mode="company" initialConversationId={summary.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "End conversation" }));
    expect(confirm).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(`/conversations/${summary.id}/end`, {});
    expect(await screen.findByText(/You ended this conversation/)).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows the company name, a status and the reviewer's review name to the company", async () => {
    render(<ConversationInbox mode="company" />);
    const row = await screen.findByRole("button", { name: /Demo Finans Holding/ });
    expect(row).toHaveTextContent("Active");
    expect(row).toHaveTextContent("Quiet Beaver");
  });

  it("shows the reviewer the answering owner's name, or a stand-in until they add one", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/conversations")
          ? [summary, { ...summary, id: "44444444-4444-4444-8444-444444444444", ended: true, ownerName: "Ahmet Yılmaz" }]
          : thread(),
      ),
    );
    render(<ConversationInbox mode="reviewer" />);
    const rows = await screen.findAllByRole("button", { name: /Demo Finans Holding/ });
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[0]).toHaveTextContent("Company representative");
    expect(rows[1]).toHaveTextContent("Ended");
    expect(rows[1]).toHaveTextContent("Ahmet Yılmaz");
    expect(rows[0]).not.toHaveTextContent("Quiet Beaver");
  });

  it("warns under a message that shares a phone number, and while one is being typed", async () => {
    const withNumber = thread({
      messages: [
        { id: "44444444-4444-4444-8444-444444444444", fromMe: false, day: "2026-09-25", content: "My number is 0532 123 45 67", sharesPhoneNumber: true },
      ],
    });
    get.mockImplementation((path: string) => Promise.resolve(path.startsWith("/conversations/") ? withNumber : [summary]));
    render(<ConversationInbox mode="reviewer" initialConversationId={summary.id} />);
    expect(await screen.findAllByText(/Be careful while sharing your phone number/)).toHaveLength(1);
    await userEvent.type(screen.getByLabelText("Your message"), "mine is 0533 765 43 21");
    expect(screen.getAllByText(/Be careful while sharing your phone number/)).toHaveLength(2);
  });

  it("shows an empty state when there are no conversations", async () => {
    get.mockResolvedValue([]);
    render(<ConversationInbox mode="reviewer" />);
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });
});

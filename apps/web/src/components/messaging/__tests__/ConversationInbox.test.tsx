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
    companyName: "Demo Finans Holding",
    reviewExcerpt: "Managers were fair but the shifts were long.",
    messages: [{ id: "33333333-3333-4333-8333-333333333333", fromMe: false, day: "2026-09-25", content: "Can I explain the shift issue?" }],
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
  it("loads the company inbox and opens a conversation, marking it read", async () => {
    render(<ConversationInbox mode="company" companyId="c1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Quiet Beaver/ }));
    expect(get).toHaveBeenCalledWith("/owner/companies/c1/conversations");
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
    render(<ConversationInbox mode="company" companyId="c1" initialConversationId={summary.id} />);
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
    render(<ConversationInbox mode="company" companyId="c1" initialConversationId={summary.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "End conversation" }));
    expect(confirm).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(`/conversations/${summary.id}/end`, {});
    expect(await screen.findByText(/You ended this conversation/)).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("shows an empty state when there are no conversations", async () => {
    get.mockResolvedValue([]);
    render(<ConversationInbox mode="reviewer" />);
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartConversationButton } from "../StartConversationButton";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiPost: jest.fn() };
});
const post = apiClient.apiPost as jest.Mock;

const REVIEW = "22222222-2222-4222-8222-222222222222";
const CONV = "11111111-1111-4111-8111-111111111111";

beforeEach(() => post.mockReset());

describe("StartConversationButton", () => {
  it("links to the existing conversation instead of starting a new one", () => {
    render(<StartConversationButton reviewId={REVIEW} companyName="Acme" conversationId={CONV} />);
    expect(screen.getByRole("link", { name: "Open conversation" })).toHaveAttribute("href", `/me?tab=messages&c=${CONV}`);
  });

  it("sends the first message and then links to the new conversation", async () => {
    post.mockResolvedValue({ id: CONV });
    render(<StartConversationButton reviewId={REVIEW} companyName="Acme" conversationId={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Message Acme" }));
    expect(screen.getByText(/only sees the name shown on your review/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "Can I add some detail?");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(post).toHaveBeenCalledWith(`/reviews/${REVIEW}/conversation`, { content: "Can I add some detail?" });
    expect(await screen.findByRole("link", { name: "Open conversation" })).toHaveAttribute("href", `/me?tab=messages&c=${CONV}`);
  });

  it("keeps the draft and shows why a message was blocked", async () => {
    post.mockRejectedValue(new apiClient.ApiError("Your message couldn't be sent: PHONE_NUMBER.", 400, null));
    render(<StartConversationButton reviewId={REVIEW} companyName="Acme" conversationId={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Message Acme" }));
    await userEvent.type(screen.getByRole("textbox"), "0532 123 45 67");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be sent");
    expect(screen.getByRole("textbox")).toHaveValue("0532 123 45 67");
  });
});

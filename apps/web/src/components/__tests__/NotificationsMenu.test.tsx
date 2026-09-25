import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Notification } from "@iwtr/shared-types";
import { NotificationsMenu } from "../NotificationsMenu";
import { clearNotificationReadState } from "@/lib/notificationReadState";
import { announceNewNotifications } from "@/lib/notification-events";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ role: "MEMBER" }) }));
jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiGet: jest.fn() };
});
const get = apiClient.apiGet as jest.Mock;

const reply: Notification = {
  id: "reply-1",
  type: "COMPANY_REPLY",
  companyName: "Acme",
  companySlug: "acme",
  createdAt: new Date().toISOString(),
};

const badge = () => screen.getByRole("button", { name: "Notifications" }).querySelector("[data-unread-badge]");

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
});

describe("NotificationsMenu", () => {
  it("lights up for a new notification without having to open it first", async () => {
    get.mockResolvedValue([reply]);
    render(<NotificationsMenu />);
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it("never shows made-up sample notifications", async () => {
    get.mockResolvedValue([reply]);
    render(<NotificationsMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Acme replied to your review.")).toBeInTheDocument();
    expect(screen.queryByText(/Verify your number/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your review is removed/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows an honest error, not sample data, when loading fails", async () => {
    get.mockRejectedValue(new Error("offline"));
    render(<NotificationsMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("remembers what was read after a reload", async () => {
    get.mockResolvedValue([reply]);
    const first = render(<NotificationsMenu />);
    await waitFor(() => expect(badge()).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));
    first.unmount();

    const callsBefore = get.mock.calls.length;
    render(<NotificationsMenu />);
    await waitFor(() => expect(get.mock.calls.length).toBe(callsBefore + 1));
    await act(async () => {});
    expect(badge()).toBeNull();
  });

  it("forgets read state on sign-out, so the next account starts clean", async () => {
    get.mockResolvedValue([reply]);
    const first = render(<NotificationsMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark all as read" }));
    first.unmount();
    clearNotificationReadState();

    render(<NotificationsMenu />);
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it("refetches when something announces a new notification", async () => {
    get.mockResolvedValueOnce([]).mockResolvedValue([reply]);
    render(<NotificationsMenu />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(badge()).toBeNull();
    act(() => announceNewNotifications());
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it("refetches every time it's opened, so the list is never stale", async () => {
    get.mockResolvedValue([]);
    render(<NotificationsMenu />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});

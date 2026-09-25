import { render, screen } from "@testing-library/react";
import { AnonGate } from "../AnonGate";

const auth = { isLoading: true, isAuthenticated: false, openAuthModal: jest.fn() };
jest.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

beforeEach(() => {
  auth.isLoading = true;
  auth.isAuthenticated = false;
});

describe("AnonGate", () => {
  it("shows the register prompt straight away when the server already knows there's no session", () => {
    render(
      <AnonGate title="See what it's really like" description="Register for free" assumeAnonymous>
        <p>secret content</p>
      </AnonGate>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "See what it's really like" })).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("still waits for the session check when there might be a session", () => {
    render(
      <AnonGate title="See what it's really like" description="Register for free">
        <p>secret content</p>
      </AnonGate>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows the real content to a signed-in member", () => {
    auth.isLoading = false;
    auth.isAuthenticated = true;
    render(
      <AnonGate title="t" description="d" assumeAnonymous>
        <p>secret content</p>
      </AnonGate>,
    );
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { GlobalChatDock } from "../GlobalChatDock";

let mockPath = "/";
let mockAuth: Record<string, unknown> = {};
jest.mock("next/navigation", () => ({ usePathname: () => mockPath }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("../ChatDock", () => ({ ChatDock: () => <div data-testid="dock" /> }));

const member = { isAuthenticated: true, onboardingStatus: { status: "ACTIVE" }, companyAccount: null };

beforeEach(() => {
  mockPath = "/";
  mockAuth = member;
});

describe("GlobalChatDock", () => {
  it.each(["/", "/jobs", "/social", "/companies/acme", "/me/reviews"])("shows the Messages dock on %s", (path) => {
    mockPath = path;
    render(<GlobalChatDock />);
    expect(screen.getByTestId("dock")).toBeInTheDocument();
  });

  it.each(["/me", "/my/companies", "/admin/dashboard"])("keeps it off %s", (path) => {
    mockPath = path;
    render(<GlobalChatDock />);
    expect(screen.queryByTestId("dock")).not.toBeInTheDocument();
  });

  it("is not shown to a logged-out visitor or an account still onboarding", () => {
    mockAuth = { isAuthenticated: false, onboardingStatus: null, companyAccount: null };
    const { rerender } = render(<GlobalChatDock />);
    expect(screen.queryByTestId("dock")).not.toBeInTheDocument();
    mockAuth = { ...member, onboardingStatus: { status: "PENDING_PII" } };
    rerender(<GlobalChatDock />);
    expect(screen.queryByTestId("dock")).not.toBeInTheDocument();
  });

  it("leaves a company login to the Dashboard's own dock", () => {
    mockAuth = { ...member, companyAccount: { companyName: "Acme" } };
    render(<GlobalChatDock />);
    expect(screen.queryByTestId("dock")).not.toBeInTheDocument();
  });
});

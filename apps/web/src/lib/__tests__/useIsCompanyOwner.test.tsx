import { renderHook } from "@testing-library/react";
import { useIsCompanyOwner } from "../useIsCompanyOwner";
import * as authContext from "../auth-context";

jest.mock("../auth-context");

function mockAuth(v: Partial<ReturnType<typeof authContext.useAuth>>) {
  (authContext.useAuth as jest.Mock).mockReturnValue({
    isAuthenticated: false,
    role: null,
    onboardingStatus: null,
    ...v,
  });
}

describe("useIsCompanyOwner", () => {
  it("is false when logged out", () => {
    mockAuth({ isAuthenticated: false });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is false for an ACTIVE member", () => {
    mockAuth({ isAuthenticated: true, role: "MEMBER", onboardingStatus: { status: "ACTIVE" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is false for a COMPANY_OWNER mid-onboarding", () => {
    mockAuth({ isAuthenticated: true, role: "COMPANY_OWNER", onboardingStatus: { status: "PENDING_AVATAR" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is true for an ACTIVE COMPANY_OWNER", () => {
    mockAuth({ isAuthenticated: true, role: "COMPANY_OWNER", onboardingStatus: { status: "ACTIVE" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(true);
  });
});

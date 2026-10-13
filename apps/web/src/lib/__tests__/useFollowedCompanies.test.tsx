import { renderHook, waitFor } from "@testing-library/react";
import { useFollowedCompanies } from "../useFollowedCompanies";
import * as apiClient from "@/lib/api-client";

let mockAuth: { isAuthenticated: boolean; role: string | null };
jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));

const followed = [{ companyId: "c1", companyName: "Acme", companySlug: "acme", mainPhotoUrl: null, badgeTier: "FREE" }];

it("still loads the member's list when the page mounted before the session check answered", async () => {
  jest.mocked(apiClient.apiGet).mockResolvedValue(followed);
  // First render: the session isn't known yet, so this looks like a visitor.
  mockAuth = { isAuthenticated: false, role: null };
  const { result, rerender } = renderHook(() => useFollowedCompanies());
  expect(result.current.followedIds.size).toBe(0);
  expect(apiClient.apiGet).not.toHaveBeenCalled();

  mockAuth = { isAuthenticated: true, role: "MEMBER" };
  rerender();
  await waitFor(() => expect(result.current.followedIds.has("c1")).toBe(true));
  expect(apiClient.apiGet).toHaveBeenCalledWith("/me/follows/companies");

  // Logging out forgets the list instead of keeping it for whoever is next.
  mockAuth = { isAuthenticated: false, role: null };
  rerender();
  await waitFor(() => expect(result.current.followedIds.size).toBe(0));
});

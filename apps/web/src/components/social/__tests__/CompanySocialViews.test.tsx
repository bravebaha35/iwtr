import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompanySocialHeader } from "../CompanySocialHeader";
import { CompanyPhotoGrid } from "../CompanyPhotoGrid";
import * as apiClient from "@/lib/api-client";

let mockFollowed: { confirmedToggles: number };
jest.mock("@/lib/api-client");
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));

beforeEach(() => {
  jest.mocked(apiClient.apiGet).mockReset();
  mockFollowed = { confirmedToggles: 0 };
});

describe("CompanySocialHeader", () => {
  it("shows the counts, switches view, and reads the counts again once a follow has been saved", async () => {
    jest.mocked(apiClient.apiGet).mockResolvedValueOnce({ followerCount: 1, postCount: 4 }).mockResolvedValueOnce({ followerCount: 2, postCount: 4 });
    const onViewChange = jest.fn();
    const { rerender } = render(<CompanySocialHeader company={{ slug: "acme" }} view="posts" onViewChange={onViewChange} />);

    expect(await screen.findByText("1 follower")).toBeInTheDocument();
    expect(screen.getByText("4 posts")).toBeInTheDocument();
    expect(apiClient.apiGet).toHaveBeenCalledWith("/social/companies/acme/summary");
    // Following is the company page header's own button, not repeated here.
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Photos" }));
    expect(onViewChange).toHaveBeenCalledWith("photos");

    mockFollowed = { confirmedToggles: 1 };
    rerender(<CompanySocialHeader company={{ slug: "acme" }} view="posts" onViewChange={onViewChange} />);
    expect(await screen.findByText("2 followers")).toBeInTheDocument();
  });
});

describe("CompanyPhotoGrid", () => {
  const post = (id: string, imageUrls: string[]) => ({ id, companyName: "Acme", caption: null, imageUrls });

  it("lays out every photo of every post, each linking to its post, and loads the next page on request", async () => {
    jest
      .mocked(apiClient.apiGet)
      .mockResolvedValueOnce({ posts: [post("p1", ["/u/a.webp", "/u/b.webp"]), post("p2", ["/u/c.webp"])], nextCursor: "p2" })
      .mockResolvedValueOnce({ posts: [post("p3", ["/u/d.webp"])], nextCursor: null });
    render(<CompanyPhotoGrid slug="acme" />);

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    expect(apiClient.apiGet).toHaveBeenCalledWith("/social/companies/acme/posts");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/social/posts/p1",
      "/social/posts/p1",
      "/social/posts/p2",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Show more photos" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
    expect(apiClient.apiGet).toHaveBeenLastCalledWith("/social/companies/acme/posts?cursor=p2");
    expect(screen.queryByRole("button", { name: "Show more photos" })).not.toBeInTheDocument();
  });

  it("says so when the company has no photos", async () => {
    jest.mocked(apiClient.apiGet).mockResolvedValue({ posts: [], nextCursor: null });
    render(<CompanyPhotoGrid slug="acme" />);
    expect(await screen.findByText("No photos yet.")).toBeInTheDocument();
  });
});

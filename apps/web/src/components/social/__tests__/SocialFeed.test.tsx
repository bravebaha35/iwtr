import { render, screen, waitFor } from "@testing-library/react";
import { SocialFeed } from "../SocialFeed";
import { clearSocialCache, notifySocialPosted } from "../socialFeedCache";
import * as apiClient from "@/lib/api-client";
import type { PublicSocialPost } from "@iwtr/shared-types";
import { makePost } from "./fixtures";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, openAuthModal: jest.fn() }) }));
jest.mock("@/lib/useIsCompanyOwner", () => ({ useIsCompanyOwner: () => false }));

const post = (id: string): PublicSocialPost => makePost({ id, imageUrls: [`/u/${id}.webp`], caption: null, likedByMe: null });

beforeEach(() => {
  clearSocialCache();
  jest.mocked(apiClient.apiGet).mockReset();
});

describe("SocialFeed (all)", () => {
  it("renders the first page and injects an AdSlot after every 7th post", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValueOnce({
      posts: Array.from({ length: 9 }, (_, i) => post(`p${i}`)),
      nextCursor: "p8",
    });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    // exactly one ad after 9 posts (7th boundary crossed once)
    expect(screen.getAllByTestId("ad-slot")).toHaveLength(1);
  });

  it("renders no search box or sort control itself - both now live in SocialSidebar", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalled());
    expect(screen.queryByPlaceholderText(/search .*compan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sort/i)).not.toBeInTheDocument();
  });

  it("sends q/workplaceTypes/categoryGroup filters through to the feed endpoint", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} q="acme" workplaceType="OFFICE" categoryGroup="LOGISTICS" />);
    await waitFor(() =>
      expect(apiClient.apiGet).toHaveBeenCalledWith("/social/feed?q=acme&workplaceTypes=OFFICE&categoryGroup=LOGISTICS"),
    );
  });
});

describe("SocialFeed (following)", () => {
  it("asks the feed for followed companies only, keeps the sidebar filters, and has its own empty line", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "following" }} workplaceType="SERVICE" />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/social/feed?following=1&workplaceTypes=SERVICE"));
    expect(await screen.findByText(/follow a company/i)).toBeInTheDocument();
  });
});

describe("SocialFeed (company)", () => {
  it("labels the pinned post, and only on the company feed", async () => {
    const page = { posts: [{ ...post("p1"), pinned: true }, post("p2")], nextCursor: null };
    (apiClient.apiGet as jest.Mock).mockResolvedValue(page);
    const { unmount } = render(<SocialFeed scope={{ kind: "company", slug: "acme" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(screen.getAllByText("Pinned")).toHaveLength(1);
    unmount();

    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
  });
});

describe("SocialFeed (saved)", () => {
  it("fetches /me/saved-posts and shows a saved-specific empty state", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "saved" }} />);
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith("/me/saved-posts"));
    expect(await screen.findByText(/haven't saved any posts yet/i)).toBeInTheDocument();
  });
});

describe("SocialFeed without waits", () => {
  it("shows post-shaped placeholders, not a Loading line, while a list is read for the first time", async () => {
    (apiClient.apiGet as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<SocialFeed scope={{ kind: "all" }} />);
    expect(screen.getByRole("status", { name: "Loading posts" })).toBeInTheDocument();
    expect(screen.queryByText(/^Loading/)).not.toBeInTheDocument();
  });

  it("shows a list it has already read at once on coming back, and still reads it again", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [post("p1"), post("p2")], nextCursor: null });
    const first = render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    first.unmount();

    (apiClient.apiGet as jest.Mock).mockClear();
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [post("p3"), post("p1"), post("p2")], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    // straight from memory: no placeholders, both posts there before any answer
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // ...and the fresh answer replaces it
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
    expect(apiClient.apiGet).toHaveBeenCalledWith("/social/feed");
  });

  it("only the first card's photo loads eagerly; the rest wait until they are near", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [post("p1"), post("p2")], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    const photos = screen.getAllByRole("img").filter((img) => img.getAttribute("src")?.startsWith("/u/"));
    expect(photos.map((img) => img.getAttribute("loading"))).toEqual(["eager", "lazy"]);
    // the first photo's own proportions hold the slider's place before it arrives
    expect((photos[0].closest("[style*=aspect-ratio]") as HTMLElement).style.aspectRatio).toBe("1.5");
  });

  it("reads the list again when a post has just been published, without a page reload", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [post("p1")], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [post("new"), post("p1")], nextCursor: null });
    notifySocialPosted();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  });
});

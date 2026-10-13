import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SocialPostCard } from "../SocialPostCard";
import * as apiClient from "@/lib/api-client";
import { makePost } from "./fixtures";

const openAuthModal = jest.fn();
const toggleFollow = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/api-client");
jest.mock("@/lib/useFollowedCompanies", () => ({ useFollowedCompanies: () => mockFollowed }));
let mockAuth: { isAuthenticated: boolean; role?: string; openAuthModal: jest.Mock };
let mockFollowed: { followedIds: Set<string>; canFollow: boolean; toggleFollow: jest.Mock };

const basePost = makePost();

beforeEach(() => {
  openAuthModal.mockClear();
  toggleFollow.mockClear();
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
});

it("anonymous Like click opens the auth modal and does not call the API", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const apiPost = apiClient.apiPost as jest.Mock;
  render(<SocialPostCard post={basePost} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  expect(openAuthModal).toHaveBeenCalledTimes(1);
  expect(apiPost).not.toHaveBeenCalled();
});

it("authenticated Like click toggles optimistically and calls the API", async () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  const apiPost = apiClient.apiPost as jest.Mock;
  apiPost.mockResolvedValue({
    postId: "p1", likeCount: 3, likedByMe: true, myReaction: "LIKE", reactionCounts: { LIKE: 3, WELL_DONE: 0, CURIOUS: 0 },
  });
  const onChanged = jest.fn();
  render(<SocialPostCard post={basePost} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  // SocialPostCard is a controlled component (display always follows the
  // post prop) - this isolated render has no stateful parent applying
  // onChanged back onto post, so assert the callback contract instead of
  // the DOM: the optimistic call, then the server-confirmed call.
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/social/posts/p1/like", { reaction: "LIKE" }));
  // first the guess, shown at once...
  expect(onChanged.mock.calls[0][0]).toMatchObject({ likeCount: 3, myReaction: "LIKE", reactionCounts: { LIKE: 3 } });
  // ...then the server's own counts
  expect(onChanged).toHaveBeenLastCalledWith(expect.objectContaining({ likeCount: 3, likedByMe: true, myReaction: "LIKE" }));
});

it("authenticated Save click toggles optimistically and calls the API - no count shown", async () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  const apiPost = apiClient.apiPost as jest.Mock;
  apiPost.mockResolvedValue({ postId: "p1", saved: true });
  const onChanged = jest.fn();
  render(<SocialPostCard post={basePost} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/social/posts/p1/save", {}));
  expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ savedByMe: true }));
});

it("shows '+ Follow' for a MEMBER not yet following, and toggles on click", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: true, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  const followButton = screen.getByRole("button", { name: "+ Follow" });
  fireEvent.click(followButton);
  expect(toggleFollow).toHaveBeenCalledWith(
    "c1",
    expect.objectContaining({ companyName: "Acme", companySlug: "acme" }),
  );
});

it("shows a muted 'Following' indicator once the company is followed", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(["c1"]), canFollow: true, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
});

it("hides the Follow button entirely for a signed-in non-MEMBER (e.g. an owner)", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  mockFollowed = { followedIds: new Set(), canFollow: false, toggleFollow };
  render(<SocialPostCard post={basePost} />);
  expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
});

it("shows no arrows for a single-photo post", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  render(<SocialPostCard post={basePost} />);
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /previous photo/i })).not.toBeInTheDocument();
});

it("a multi-photo post shows a Next arrow first, then a Previous arrow after advancing, and stops at the last photo", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const multi = { ...basePost, imageUrls: ["/u/1.webp", "/u/2.webp", "/u/3.webp"] };
  render(<SocialPostCard post={multi} />);

  expect(screen.queryByRole("button", { name: /previous photo/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.getByRole("button", { name: /previous photo/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
});

it("the time links to the post's own page, and an edited post says so", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  render(<SocialPostCard post={{ ...basePost, edited: true }} />);
  expect(screen.getByTitle("Open this post")).toHaveAttribute("href", "/social/posts/p1");
  expect(screen.getByText(/Edited/)).toBeInTheDocument();
});

it("Copy link puts the post's own address on the clipboard", async () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<SocialPostCard post={basePost} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/social/posts/p1`);
  expect(await screen.findByText("Link copied")).toBeInTheDocument();
});

it("shows no post options to someone who can't manage the post", () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  render(<SocialPostCard post={basePost} />);
  expect(screen.queryByRole("button", { name: "Post options" })).not.toBeInTheDocument();
});

describe("owner's post options", () => {
  const owned = { ...basePost, canManage: true };
  const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Post options" }));

  beforeEach(() => {
    mockAuth = { isAuthenticated: true, openAuthModal };
    mockFollowed = { followedIds: new Set(), canFollow: false, toggleFollow };
    jest.mocked(apiClient.apiPost).mockReset();
    jest.mocked(apiClient.apiPatch).mockReset();
    jest.mocked(apiClient.apiDelete).mockReset();
  });

  it("Edit caption saves the new text and hands back the updated post", async () => {
    const updated = { ...owned, caption: "new words", edited: true };
    jest.mocked(apiClient.apiPatch).mockResolvedValue(updated);
    const onChanged = jest.fn();
    render(<SocialPostCard post={owned} onChanged={onChanged} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit caption" }));
    const box = screen.getByLabelText("Caption");
    expect(box).toHaveValue("hi");
    fireEvent.change(box, { target: { value: "  new words  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save caption" }));
    await waitFor(() => expect(apiClient.apiPatch).toHaveBeenCalledWith("/social/posts/p1", { caption: "new words" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(screen.queryByLabelText("Caption")).not.toBeInTheDocument();
  });

  it("shows the server's reason when the new caption is refused, and keeps the text being edited", async () => {
    // The api-client module is auto-mocked, so the error class keeps no message of its own.
    const refused = Object.assign(new apiClient.ApiError("", 400, null), { message: "That caption breaks our content rules" });
    jest.mocked(apiClient.apiPatch).mockRejectedValue(refused);
    render(<SocialPostCard post={owned} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit caption" }));
    fireEvent.click(screen.getByRole("button", { name: "Save caption" }));
    expect(await screen.findByText(/breaks our content rules/)).toBeInTheDocument();
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
  });

  it("Delete asks first; Keep it does nothing, Delete post removes it", async () => {
    jest.mocked(apiClient.apiDelete).mockResolvedValue({ success: true });
    const onDeleted = jest.fn();
    render(<SocialPostCard post={owned} onDeleted={onDeleted} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText(/comments and likes go with it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(apiClient.apiDelete).not.toHaveBeenCalled();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));
    await waitFor(() => expect(apiClient.apiDelete).toHaveBeenCalledWith("/social/posts/p1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("p1"));
  });

  it("Pin to top pins and reports it; a pinned post offers Unpin instead", async () => {
    jest.mocked(apiClient.apiPost).mockResolvedValue({ postId: "p1", pinned: true });
    const onPinToggled = jest.fn();
    const { unmount } = render(<SocialPostCard post={owned} onPinToggled={onPinToggled} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin to top" }));
    await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/posts/p1/pin", {}));
    await waitFor(() => expect(onPinToggled).toHaveBeenCalledWith("p1", true));
    unmount();

    render(<SocialPostCard post={{ ...owned, pinned: true }} showPinned />);
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    openMenu();
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Unpin" })).toBeInTheDocument();
  });
});

describe("beaver reactions", () => {
  beforeEach(() => {
    mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal };
    jest.mocked(apiClient.apiPost).mockReset();
    jest.mocked(apiClient.apiPost).mockResolvedValue({
      postId: "p1", likeCount: 3, likedByMe: true, myReaction: "WELL_DONE", reactionCounts: { LIKE: 2, WELL_DONE: 1, CURIOUS: 0 },
    });
  });

  it("More reactions opens the three beavers; picking one sends that reaction", async () => {
    const onChanged = jest.fn();
    render(<SocialPostCard post={basePost} onChanged={onChanged} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More reactions" }));
    const menu = screen.getByRole("menu", { name: "Reactions" });
    expect(within(menu).getAllByRole("menuitemradio").map((b) => b.getAttribute("aria-label"))).toEqual(["Like", "Well done", "Curious"]);

    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Well done" }));
    await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/posts/p1/like", { reaction: "WELL_DONE" }));
    expect(onChanged.mock.calls[0][0]).toMatchObject({ myReaction: "WELL_DONE", likeCount: 3, reactionCounts: { LIKE: 2, WELL_DONE: 1 } });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("swapping a reaction keeps the total; the main button takes the current one back", async () => {
    const reacted = makePost({ myReaction: "CURIOUS", likedByMe: true, likeCount: 3, reactionCounts: { LIKE: 2, WELL_DONE: 0, CURIOUS: 1 } });
    const onChanged = jest.fn();
    render(<SocialPostCard post={reacted} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "More reactions" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Well done" }));
    await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0][0]).toMatchObject({ likeCount: 3, reactionCounts: { LIKE: 2, WELL_DONE: 1, CURIOUS: 0 } });

    jest.mocked(apiClient.apiPost).mockClear();
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/posts/p1/like", { reaction: "CURIOUS" }));
    expect(onChanged.mock.calls[0][0]).toMatchObject({ likeCount: 2, myReaction: null, likedByMe: false });
  });
});

describe("post kinds", () => {
  const poll = (overrides = {}) =>
    makePost({
      kind: "POLL", imageUrls: [], imageAspectRatios: [], caption: "Which shift do you prefer?",
      poll: {
        endsAt: new Date(Date.now() + 2 * 86_400_000 + 60_000).toISOString(), closed: false, totalVotes: 4, myOptionId: null,
        options: [{ id: "o1", text: "Morning", votes: null }, { id: "o2", text: "Night", votes: null }],
        ...overrides,
      },
    });

  beforeEach(() => {
    mockAuth = { isAuthenticated: true, role: "MEMBER", openAuthModal };
    jest.mocked(apiClient.apiPost).mockReset();
  });

  it("a text-only update has no photo block", () => {
    render(<SocialPostCard post={makePost({ kind: "UPDATE", imageUrls: [], imageAspectRatios: [], caption: "We moved offices." })} />);
    expect(screen.getByText("We moved offices.")).toBeInTheDocument();
    expect(screen.queryByAltText("We moved offices.")).not.toBeInTheDocument();
  });

  it("a member votes on a poll: no split before, the returned post (with the split) after", async () => {
    const voted = poll({ myOptionId: "o2", totalVotes: 5, options: [{ id: "o1", text: "Morning", votes: 3 }, { id: "o2", text: "Night", votes: 2 }] });
    jest.mocked(apiClient.apiPost).mockResolvedValue(voted);
    const onChanged = jest.fn();
    const { rerender } = render(<SocialPostCard post={poll()} onChanged={onChanged} />);
    expect(screen.getByText("Which shift do you prefer?")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText(/4 votes/).closest("p")).toHaveTextContent("2 days left");

    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    await waitFor(() => expect(apiClient.apiPost).toHaveBeenCalledWith("/social/posts/p1/poll-vote", { optionId: "o2" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(voted));

    rerender(<SocialPostCard post={voted} onChanged={onChanged} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Night/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("a closed poll shows the result and takes no more votes; an employer can look but not vote", () => {
    const closed = poll({ closed: true, options: [{ id: "o1", text: "Morning", votes: 3 }, { id: "o2", text: "Night", votes: 1 }] });
    const { unmount } = render(<SocialPostCard post={closed} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/Poll closed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Morning/ })).not.toBeInTheDocument();
    unmount();

    mockAuth = { isAuthenticated: true, role: "COMPANY_OWNER", openAuthModal };
    render(<SocialPostCard post={poll()} />);
    expect(screen.queryByRole("button", { name: /Morning/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only members can vote/)).toBeInTheDocument();
  });

  it("the owner of a poll can pin or delete it but not reword it", () => {
    render(<SocialPostCard post={{ ...poll(), canManage: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Post options" }));
    expect(screen.queryByRole("menuitem", { name: "Edit caption" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("an event shows its name, date and place", () => {
    const startsAt = new Date(2030, 4, 18, 14, 0);
    render(
      <SocialPostCard
        post={makePost({ kind: "EVENT", imageUrls: [], imageAspectRatios: [], caption: null, title: "Open day", eventStartsAt: startsAt.toISOString(), eventLocation: "Manisa plant" })}
      />,
    );
    expect(screen.getByText("Open day")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    const when = screen.getByText(/18 May 2030/);
    expect(when).toHaveAttribute("datetime", startsAt.toISOString());
    expect(when).toHaveTextContent("14:00");
    expect(when.closest("p")).toHaveTextContent("Manisa plant");
  });

  it("a milestone shows its headline", () => {
    render(<SocialPostCard post={makePost({ kind: "MILESTONE", caption: null, title: "10 years in business" })} />);
    expect(screen.getByText("10 years in business")).toBeInTheDocument();
  });

  it("a hiring post links to the job while it is live, and says so once it isn't", () => {
    const job = { jobPostingId: "j1", jobTitle: "Forklift Operator", workType: "MANUAL_LABOUR" as const, positions: ["BLUE_COLLAR" as const], live: true };
    const { unmount } = render(<SocialPostCard post={makePost({ kind: "HIRING", imageUrls: [], imageAspectRatios: [], caption: null, job })} />);
    expect(screen.getByText("Forklift Operator")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the job" })).toHaveAttribute("href", "/companies/acme?tab=jobs");
    unmount();

    render(<SocialPostCard post={makePost({ kind: "HIRING", imageUrls: [], imageAspectRatios: [], caption: null, job: { ...job, live: false } })} />);
    expect(screen.queryByRole("link", { name: "See the job" })).not.toBeInTheDocument();
    expect(screen.getByText("This position is no longer open.")).toBeInTheDocument();
  });
});

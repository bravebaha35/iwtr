# IWT Social redesign - design

Date: 2026-10-13. Approved in chat by the product owner ("Yes go ahead"): all four phases in
this order, and members may start Questions (phase 3). Phase 1 is specified in full here;
phases 2 to 4 get their own spec when their turn comes.

## Why

The owner's words: the Social pages feel "so basic, like something is missing". Today only
companies post, only photos, and members can only like, comment, save and follow. The page is
one narrow column with empty space beside it, a post has no address of its own, and an owner
cannot change or remove what they posted.

## Phases

1. New layout and post basics (this spec).
2. More to post: text-only updates, polls, events, milestones, "We're hiring" posts tied to a
   job ad, beaver reactions.
3. Members' voice: anonymous Questions to a company or a field of work, answered by people
   with a "Worked there" badge and by the owner under their real name. Same moderation as
   reviews. Terms need the lawyer first.
4. Owner tools: post views, follower growth, scheduling, tied to plans.

Not planned: video (storage and moderation cost), member profiles or connections (anonymity).

## Phase 1

### IWT Social page (`/social`)

- Three columns inside the page: filter sidebar (unchanged width, locked by `SidebarShell`),
  the feed (`max-w-xl`), and a new right-hand rail (shown from `lg` up).
- Feed tabs as plain words with a Wood bar under the open one: **Explore** (every company,
  newest first, the sidebar filters apply), **Following** (only companies the member follows),
  **Saved**. Following and Saved are member-only; anyone else sees no tab row. "Explore"
  rather than "For you" because nothing is personalised yet. The sidebar's Saved Posts button
  goes away (it is a tab now); the Following list stays as a jump list.
- Right-hand rail, three quiet panels, each hidden when empty:
  - **Trending this week**: the last 7 days' most liked and most commented posts as one
    short list (replaces the full-size repeats above the feed; a week because a single day
    is usually empty).
  - **Companies to follow**: up to 5 public companies that have posted and that the viewer
    does not follow yet, most followed first.
  - **Hiring this week**: up to 5 job ads posted in the last 7 days, one per company.
  - The page's right-side ad moves under these panels; the left ad rail stays.
- Welcome pop-up for owners: the empty placeholder box becomes the site's beaver artwork.

### Post card

- A soft separated card (`rounded-2xl bg-surface shadow-xs`, photo flush), the same family as
  job and company cards.
- The time is a link to the post's own page. "Edited" shows after an edit; "Pinned" shows on
  the company tab.
- Footer: like, comment, copy link, save.
- A "..." menu for an approved owner of the post's company: Edit caption, Pin / Unpin, Delete.
  Delete asks once, inside the card.

### Post page (`/social/posts/:id`)

One post with its comments open, behind the same register gate as `/social`. Share links and
the card's time link point here.

### Company Social tab

- A line above the feed: follower count and post count, and two views as plain words:
  **Posts** and **Photos**. Following stays the one button in the company page header; the
  count is read again each time a follow has been saved.
- Photos: a grid of every photo from the posts loaded so far; a click opens that post's page.
- A pinned post leads the default (newest) order. One pinned post per company.

### API

- `SocialPost` gains `pinnedAt` and `editedAt` (both nullable).
- `PublicSocialPost` gains `pinned`, `edited`, `canManage` (viewer is an approved owner of the
  post's company). Still no author id anywhere.
- `GET social/feed?following=1`: posts from companies the caller follows (empty when logged out).
- `GET social/posts/:id`: one post; 404 when its company is hidden.
- `PATCH social/posts/:id`: caption only, same caption checks as create, sets `editedAt`.
- `DELETE social/posts/:id`: removes the post, its thread and its image files; audit-logged.
- `POST social/posts/:id/pin`: toggle; pinning unpins the company's other post.
- `GET social/rail`: `{ suggestedCompanies, hiringNow }`.
- `GET social/companies/:slug/summary`: `{ followerCount, postCount }`. A bare count only, as
  REVIEW.md requires: never the follower list.
- Edit, delete and pin are for an approved owner of that post's company. None of the new
  routes is opened to the shared company login.

### Tests

Service tests for each new method (ownership, hidden company, one-pin rule, following filter),
schema tests for the new input, component tests for the tabs, the owner menu, the rail and the
company views. Then a click-through on the running site in both themes.

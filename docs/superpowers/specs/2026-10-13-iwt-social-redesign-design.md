# IWT Social redesign - design

Date: 2026-10-13. Approved in chat by the product owner ("Yes go ahead"): all four phases in
this order, and members may start Questions (phase 3). Phases 1 and 2 are specified here and
built; phases 3 and 4 get their own section when their turn comes.

With the go-ahead for phase 2 the owner added two standing wishes: put performance first
("so the website can work without loads") and design with the Taste Skill.

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

## Phase 2

### More to post

A post has a kind. The composer picks it from one row of plain-word tabs: **Update, Poll,
Event, Milestone, Hiring**.

- **Update**: text, photos, or both ("Write something or add a photo"). Stored as PHOTO when
  it has photos and UPDATE when it is text only.
- **Poll**: a question, 2 to 4 different answers, open for 1 day, 3 days, 1 week or 2 weeks. No
  photos. Members vote (one vote, movable until it closes); employers and admins only look.
  The split of votes stays hidden from a member until they have voted or the poll has closed;
  an owner of the company always sees it. Counts only: who voted is never exposed. A poll
  cannot be reworded once posted, only deleted.
- **Event**: a name, a date and time that is still ahead, an optional place and details.
- **Milestone**: a headline ("10 years in business"), optional words and photos.
- **Hiring**: one of the company's own live job postings, shown inside the post with a link to
  the company's Job Postings tab. Once the ad is filled, expired or gone the post says the
  position is no longer open.

Every piece of text the company writes (caption, headline, place, each poll answer) goes
through the same content rules as a caption.

### Beaver reactions

Three reactions, each the site's own beaver: **Like**, **Well done**, **Curious**. One per
member per post: the same one again takes it off, another one replaces it. The like button
still works with one click (a plain like); resting the pointer on it, or the small arrow
beside it, opens the three beavers. Only positive and curious reactions: a "dislike" on a
company's own post would invite pile-ons that the comment rules exist to prevent.

### No waiting

- A list this visit has already shown (a feed tab, a company's posts, the rail) comes back
  from memory at once and is read again behind it. Signing in or out empties that memory.
- A list seen for the first time shows post-shaped placeholders instead of "Loading...".
- Each photo's proportions are stored with the post (`imageAspectRatios`), so its space is
  held before it arrives and the feed never jumps. Photos below the first card load lazily.
  `scripts/backfill-social-image-aspects.ts` fills the proportions for older posts.
- The rail is one request instead of two, and its Trending and Hiring lists (the same for
  everyone) are built once a minute on the server.
- Publishing a post refreshes the lists on the page; the page itself is no longer reloaded.
- The next page of a feed starts loading before the end of the list is reached.

### API

- `SocialPost` gains `kind`, `title`, `eventStartsAt`, `eventLocation`, `pollEndsAt`,
  `jobPostingId`, `imageAspectRatios`. New: `SocialPollOption`, `SocialPollVote`.
  `SocialPostLike` gains `reaction`.
- `POST social/posts` takes the kind's fields; photos are optional except for a plain post
  with no text.
- `POST social/posts/:id/like` takes an optional `{ reaction }`.
- `POST social/posts/:id/poll-vote` (members only) returns the post as the voter now sees it.
- `GET social/rail` now carries `trending`; `GET social/trending` is gone.

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

## Phase 3

Go-ahead from the owner on 2026-10-13 ("You can continue Phase 3"), with one more wish: the
sidebar gets the new design too.

### Questions

A member asks a question, anonymously, to **one company** or to **everyone in a kind of work**
(Office, Hybrid/Remote, Service, Manual-Labour). 10 to 300 characters, at most 5 questions a
member a day. Members answer; the asked company's approved owner answers too.

- **Who is who.** A member appears under their usual review name or a one-off name made up for
  that question or answer alone (the same choice as a comment). The asked company's owner
  answers under their real name (EmployerProfile, never the PII vault), marked with the
  company's name, and that answer leads the thread. Another company's owner cannot answer, and
  nobody answers for a company on a kind-of-work question.
- **Worked there.** A member's answer carries this mark when the asked company was in their
  employment history at the moment they answered. It is stored with the answer and is the only
  thing it reveals.
- **One answer per account per question**, and never on your own question: a thread is a set
  of answers, not a conversation.
- **Helpful.** Members mark an answer helpful (one each, a second click takes it off); the most
  helpful answers come first after the company's. Employers see the count only.
- **Rules for the text.** The same content rules as a review or a comment, refused on the spot.
  The asked company's own name is taken out before the check, so "Does Demo Finans pay on
  time?" is not read as a person's name. After that: Report (the comment's fixed reasons);
  three reports plus a content match queue the item on `/admin/content`; nothing is removed
  without a person looking.
- **Who can remove what.** The author deletes their own question (its answers go with it) or
  answer; an admin removes either (audit-logged). A company can never delete a question put to
  it.

Where it shows:

- `/social` gains a **Questions** tab for everyone (an owner or admin now gets a tab row:
  Explore / Questions). The sidebar's search, Work-Type and Quick Select apply; the search box
  also matches the question text. Inside the tab: Newest / Unanswered / My questions.
- A company's Social tab gains a **Questions** view beside Posts and Photos, with the ask box
  already pointed at that company.
- Every question has its own page (`/social/questions/:id`) with every answer; lists carry the
  company's answer plus the two most helpful.
- The rail gains **Waiting for an answer**: the five newest questions nobody has answered.
- Notifications: the asker hears about a new answer; an owner hears about a question put to
  their company. Both open the question's page.

### The switch

Questions put member-written public text on the site, so the Terms need the lawyer first.
One switch on each side: `SOCIAL_QUESTIONS_ENABLED` (API) and
`NEXT_PUBLIC_SOCIAL_QUESTIONS_ENABLED` (web). Left unset the feature is on everywhere except
production, so it can be tried locally and stays dark on the live site until both are set to
`true` there. Off means the routes answer 404, the tab, the view and the rail panel are not
shown, and no question notifications are derived.

### Sidebar

The IWT Social sidebar now speaks the rail's language: soft white panels instead of grey pills
on the page. Search field with an icon and a "N filters on / Clear all" line; **Following** as a
panel with a count that grows with its list up to a limit; **Only Show Me** as four white beaver
tiles (no panel: they need the column's full width); **Quick Select** as quiet rows in a panel.
On a company's Social tab: **Sort** as rows in a panel, **See Them On** as named rows, and on the
Questions view a short "How questions work" panel in place of Sort. Width and gaps are still
`SidebarShell`'s.

### API

- New: `SocialQuestion`, `SocialAnswer`, `SocialAnswerVote`, `SocialQuestionReport`.
- `GET social/questions` (`cursor`, `q`, `workplaceTypes`, `categoryGroup`, `company`,
  `filter`), `GET social/questions/:id`, `GET social/questions/identity`,
  `POST social/questions` (members), `POST social/questions/:id/answers`,
  `POST social/answers/:id/helpful` (members), `POST social/questions/:id/report`,
  `POST social/answers/:id/report`, `DELETE social/questions/:id`, `DELETE social/answers/:id`.
- Admin: `GET admin/social/reported-questions`, `POST admin/social/{questions|answers}/:id/dismiss-report`,
  `DELETE admin/social/{questions|answers}/:id`.
- `GET social/rail` carries `openQuestions`.
- None of the new routes is opened to the shared company login. Company merge moves a
  duplicate's questions to the master.

## Phase 3, second pass (2026-10-14): the company sees a question first

Asked for by the owner after trying phase 3.

**Who sees a question.** `SocialQuestion.visibility` is PENDING, HIDDEN or PUBLIC.

- A question put to a company with an approved owner starts PENDING: its asker and that company's owner see it, nobody
  else is ever sent it (list, question page, rail, answering, Helpful and reporting all read through the same
  "what this viewer may be sent" rule).
- The owner is notified, and the notification opens the dashboard's new **Questions** section
  (`/my/companies?company=...&category=questions`). There the owner answers and sends the answer with one of two
  buttons: "Answer and show to everyone" (PUBLIC) or "Answer and keep hidden" (HIDDEN). The choice can be changed
  later from the same card ("Show to everyone" / "Hide").
- Showing a question always needs the company's own answer on it. Hiding never does.
- A question put to a kind of work, or to a company nobody has claimed, is PUBLIC from the start - there is nobody
  to see it first.
- The asker sees a line on their own question saying where it stands ("Sent to X. Only you and the company can see
  it until the company answers." / "X keeps this question hidden.").

**What the owner cannot do.** There is no message to the asker, by design: the company's one way to respond is its
answer, and the asker stays as anonymous to the company as to everyone else. A company still cannot delete a
question. A question that breaks the rules is sent to the admins with "Report to admin" on the card; the admin queue
marks a report that came from the asked company.

**My own decisions, not the owner's words:** an unclaimed company's questions are public at once; publishing needs
the company's answer; the shared company login does not get the Questions section (an answer is the owner speaking
under their own name); a hidden question keeps any member answers it already had, out of sight, and shows them again
if it is shown again.

**API.** `PATCH social/questions/:id/visibility`, `GET social/company-questions/:companyId` (+ `/counts`), an
optional `visibility` on the answer input (owner only; ignored from a member). None opened to the company login.

**Also in this pass.**

- IWT Social's row is three columns - 1fr, the feed, 1fr - so posts and questions sit in the exact middle of the
  page at every width from `lg` up; the right-hand ad has a column of its own beside the rail from 100rem, and the
  left ad waits for 86rem so the feed is not squeezed. Same centring on the company Social tab.
- Work-Type tiles show an object per kind of work (the owner's art: pencil, headset, two hands, hammer) instead of
  the beaver; the four default banners are the owner's new ones. The files keep the names the owner gave them.
- The gold featured job card no longer carries a "Featured" tag.
- Dashboard: "Posting Featured Job Ads" is gone as a section; "N free ads left this month" sits in bold under Job
  Postings in the side list and at the top of that section.
- `scripts/seed-social-demo.ts` writes demo polls, questions and answers in every state (dev only, re-runnable).

## Phase 4 (2026-10-14): owner tools

Go-ahead from the owner: "Continue on Phase 4". The roadmap line was "post views, follower growth, scheduling, tied
to plans"; everything below that line is my own design, to be confirmed.

### Post views

- A post counts as seen when a signed-in **member** has had at least 40% of its card on screen for a second. The page
  reports seen posts a few at a time (`POST social/views`, nothing comes back). An owner's or admin's look does not
  count, nor does anyone signed out.
- What is stored is a number: `SocialPost.viewCount` and the company's count for the day. **No row anywhere says which
  member saw which post.** So that scrolling past twice, or a script calling the route, does not inflate the number,
  the API remembers "this member, this post" for 12 hours in the server's memory only; it is never written down.
- Only an owner of the post's company is sent the number (`PublicSocialPost.viewCount`, null for everyone else). It
  shows on the owner's own cards as "128 views".

### Insights (dashboard > IWT Social)

- A new dashboard section, **IWT Social**, for the owner's own account (not the shared company login - IWT Social as a
  whole is closed to it).
- For a chosen period: followers now, with how many came and left; post views; reactions; comments; a line of followers
  over time; bars of views per day (per week over a year); the period's ten most seen posts.
- The section says in plain words that these are counts only and that nobody can see who is behind them.
- `CompanySocialDay` (company, day, postViews, followersGained, followersLost) is the one new table behind it. An
  unfollow deletes its row, so each follow and unfollow also adds one to the day's count; the followers line is worked
  back from today's count. Days are counted on Turkey's clock. `scripts/backfill-social-days.ts` fills the days before
  the table existed from the follows that are still there.
- **Plans:** how far back the period reaches - Free 7 days, Starter 30, Pro 90, Enterprise 12 months. Asking for more
  gives the plan's own reach; a longer period's button opens the plans.

### Posting later

- The composer has **When: Now / Later**. Later takes a date and time (5 minutes to 60 days ahead) and the button reads
  Schedule. The dashboard section lists what is waiting: change the time, post now, or delete.
- A waiting post is a `ScheduledSocialPost`, **not** a `SocialPost`: nothing that reads posts can show it early. Its
  text has already passed the content rules and its photos are already processed. Every 30 seconds a worker publishes
  what is due - creating the post and removing the waiting row in one transaction, so it can never go out twice.
- A poll's clock starts when it is published. An event must start after the post goes out.
- If it can no longer go out when its time comes (the job ad was filled, the event date has passed, the company has
  no approved owner), it stays in the list marked "Did not go out" with the reason, and the owner gets a notification.
- **Plans:** Free cannot schedule; Starter keeps 3 waiting at a time, Pro 10, Enterprise 30. A lapsed paid plan counts
  as Free, but posts already waiting can still be published or deleted.

### Pricing table

Two new rows: "IWT Social Insights" and "Scheduled IWT Social Posts", with the numbers above.

### API

- `POST social/views`, `GET social/company-insights/:companyId?days=`, `POST social/scheduled-posts` (the post form
  plus `publishAt`), `GET social/company-scheduled/:companyId`, `PATCH social/scheduled-posts/:id`,
  `POST social/scheduled-posts/:id/publish-now`, `DELETE social/scheduled-posts/:id`. The owner routes check approved
  ownership of that company; none is opened to the company login.
- The web proxy now passes a "no content" answer on correctly (it used to turn it into an error).

### Not done, on purpose

- No "who viewed" or "who follows" of any kind, and no per-post breakdown by day (small numbers on one post on one day
  say more about individuals than a company needs).
- No editing of a waiting post's text: delete it and write it again.
- Company merge does not carry the duplicate's daily counts or waiting posts over (they go with the duplicate).

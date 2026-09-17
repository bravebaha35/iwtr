# Skills, Sector/Work-Type, and CV Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified Skills system (many-to-many, ≤10 per member), a real relational Sector-cascading-from-Work-Type system, required Faculty-when-College validation, and restructure the CV/Personal-Information editing UI and PDF layout per the security- and anti-slop-hardened spec the user provided.

**Architecture:** New Prisma lookup tables (`Skill`, `Sector`) and a real `User.workType` column (backfilled from the existing avatar-derived category) replace ad-hoc/derived values with DB-relational, backend-validated ones. The existing `AvatarEditor` component is made dual-mode (controlled/uncontrolled) so the onboarding flow is untouched while `/me`'s Customize tab hands work-type control to a new standalone `WorkTypePicker` living in the Personal Information tab. `CvPreview.tsx` is restructured into three top-level sections in a fixed order, all still one single component snapshotted by html2pdf.js (unchanged rendering pipeline from the CV-generator/anon-gating work already on `main`).

**Tech Stack:** NestJS + Prisma (Postgres, `public` schema) on the API; Next.js App Router + Tailwind + Framer Motion 13 on the web app; zod schemas in `packages/shared-types` as the shared contract; `isomorphic-dompurify` (already a dependency) for sanitization; Jest for backend unit tests.

**Spec:** the user's message (this session, 2026-09-17) — a 4-part spec (Security & Data Isolation, Core Architecture, Frontend Implementation & Anti-Slop, Acceptance Criteria). No separate file; the full text is reproduced in Global Constraints and per-task Interfaces below.

## Global Constraints

- Skill IDs: `z.array(z.string().uuid()).max(10)` enforced on the API, not just the frontend — an 11th ID must 400.
- Skills are referenced by ID from a read-only `Skill` lookup table — never arbitrary raw strings. Same for `Sector` (referenced by ID, not a free string).
- `Skill`/`Sector` seed data is hand-curated by this plan's author (user-approved 2026-09-17 — not scraped from LinkedIn; scraping LinkedIn was explicitly declined).
- `customExperienceText` ("Information") sanitized via `DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })` before saving — **already implemented** (`apps/api/src/modules/profile/profile.service.ts:40-44`, `sanitizeFreeText`), reused as-is, not reimplemented. Sanitizing again "before rendering on the CV" is not a separate step: `CvPreview.tsx` renders this field as a plain React text child (`{profile.customExperienceText}`), never via `dangerouslySetInnerHTML`, so React's own text-node escaping is the render-time defense — a second DOMPurify pass would sanitize already-plain-text and change nothing. If a future change ever renders this field as HTML, that's the moment a render-time DOMPurify pass would need to be added.
- `User.workType` is a plain `WorkplaceType?` enum column, not a new joined lookup table — `WorkplaceType` is already a fixed 4-value enum shared with `Company.workplaceTypes`, and this repo's convention is enum columns for fixed small sets (only genuinely open-ended sets like Skill/Sector get their own table). "Lookup table for WorkType" in the spec is satisfied by the already-existing enum; only `Sector` gets a new table.
- `MyProfile` (`packages/shared-types/src/schemas/user.ts`) stays a flat object — Birthdate/Skills/WorkType/Sector/Information are added as flat top-level fields on the same `GET /me/profile` response that already bundles everything else the Personal Information/CV UI needs, rather than nested under a literal `personalInformation: {...}` sub-key. "Bundle under Personal Information payload object" is read as "returned together, from one endpoint, for the Personal Information section" (already true) — nesting the wire shape would ripple through every existing consumer of `MyProfile` (Customize, Contact, CV tabs) for no behavioral gain and meaningfully raises this plan's regression risk.
- Faculty is required on an `EducationHistory` row whenever `level === "COLLEGE"` — enforced in the zod schema (create path) and in the service layer (update path, since a PATCH may omit `level` while patching an existing COLLEGE row).
- Sector must be a valid child of the submitted Work-Type — enforced server-side by checking the resolved `Sector.workplaceTypes` array contains the effective `User.workType`.
- Typography stays Plus Jakarta Sans (`font-jakarta`, already the CV's font — no change needed). Colors stay the existing light/dark tokens already defined in `globals.css` — no new palette.
- CV section order, fixed: **Personal Information → Education → Employment History**. Section dividers are `<hr className="border-t border-[#1e293b] my-8" />` (CvPreview.tsx's own hex-color convention, not `slate-800`, since Tailwind's named palette breaks html2canvas — see that file's top comment) — no cards, no drop shadows anywhere in the CV.
- Skills subtext copy, verbatim: **"Select up to 10 verified skills."**, styled `text-xs text-slate-500 uppercase tracking-widest` (this is *editor UI*, not the CV/html2canvas-snapshotted surface, so the named `slate-500` class is fine here — only `CvPreview.tsx` itself is restricted to hex colors).
- Sector dropdown reveal uses Framer Motion: `<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}>`.
- Onboarding's `AvatarPicker.tsx` / `HistoryForm.tsx` flows must keep working exactly as they do on `main` today — this plan must not regress new-user registration.

---

### Task 1: Prisma schema — Skill, UserSkill, Sector, User.workType/sectorId

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `Skill { id, name }`, `UserSkill { id, userId, skillId }`, `Sector { id, value, label, workplaceTypes }`, `User.workType: WorkplaceType?`, `User.sectorId: String?`, `User.sector: Sector?`, `User.skills: UserSkill[]`.

- [ ] **Step 1: Add the three new models and the two new `User` fields**

Add near the end of the `public`-schema model block (anywhere after `WorkplaceType`'s enum, e.g. right before `model EducationHistory` at current line 354):

```prisma
// Read-only lookup table — the only place a Skill's canonical name lives.
// Seeded by scripts/seed-skills.ts (hand-curated, delete-all + re-insert on
// every run — see that script's own header comment for why). Never written
// to from application code; ProfileService only ever reads by id to
// validate a member's chosen skillIds against real rows.
model Skill {
  id        String      @id @default(uuid())
  name      String      @unique
  createdAt DateTime    @default(now())
  users     UserSkill[]

  @@schema("public")
}

// Explicit join table for the User<->Skill many-to-many (same convention as
// every other m-n relation in this schema — CompanyOwner, ReviewVote,
// SocialPostLike — never Prisma's implicit m-n), so it can carry its own id
// and createdAt like its siblings.
model UserSkill {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  skillId   String
  skill     Skill    @relation(fields: [skillId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, skillId])
  @@index([skillId])
  @@schema("public")
}

// Read-only lookup table for the member-profile "Sector" field — the
// DB-backed sibling of the frontend-only SECTORS constant already used for
// the company Sector/Industry filter (apps/web/src/lib/sectors.ts). Kept as
// a SEPARATE table from that constant on purpose: this one is referenced by
// ID from User.sectorId and validated server-side against workplaceTypes;
// the company-side filter stays exactly as it is today (unrelated,
// unchanged by this plan). Seeded by scripts/seed-sectors.ts from the same
// curated list.
model Sector {
  id             String          @id @default(uuid())
  value          String          @unique
  label          String
  workplaceTypes WorkplaceType[]
  createdAt      DateTime        @default(now())
  users          User[]

  @@schema("public")
}
```

- [ ] **Step 2: Add the two new scalar/relation fields to `model User`**

In `model User` (current line 198), add after `phoneVerifiedAt DateTime?` (current line 257):

```prisma
  // Explicit, first-class classification of the kind of work this member
  // does — distinct from (but initially backfilled from) their avatarKey's
  // implicit category. Nullable: existing accounts get it via
  // scripts/backfill-user-worktype-from-avatar.ts, not every account is
  // guaranteed to have one immediately after this migration. Drives the
  // Sector cascade on the Personal Information tab (see ProfileService).
  workType  WorkplaceType?
  sectorId  String?
  sector    Sector?        @relation(fields: [sectorId], references: [id])
```

And add to the relation list (after `jobApplications  JobApplication[]`, current line 289):

```prisma
  skills UserSkill[]
```

- [ ] **Step 3: Push the schema and regenerate the client**

Run from `apps/api`:
```bash
pnpm exec prisma generate
pnpm exec prisma db push
```
Expected: both succeed with no errors; `db push` reports the new `Skill`, `UserSkill`, `Sector` tables and the two new `User` columns created.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add Skill/UserSkill/Sector lookup tables and User.workType/sectorId"
```

---

### Task 2: Backfill existing users' `workType` from their avatar

**Files:**
- Create: `apps/api/scripts/backfill-user-worktype-from-avatar.ts`

**Interfaces:**
- Consumes: `User.avatarKey`, `User.workType` (from Task 1).
- Produces: every existing `User` row with a non-null `avatarKey` and null `workType` gets `workType` set.

- [ ] **Step 1: Write the script**

```ts
// One-off backfill: every account that existed before User.workType was
// added (Task 1) has its work-type implicitly encoded in avatarKey's
// prefix ("office_"/"remote_"/"service_"/"manual_") but no explicit
// workType value yet. This copies that implicit value into the new column
// once — going forward, workType is set explicitly (Personal Information
// tab / onboarding), never re-derived. Safe to re-run: only touches rows
// where workType IS NULL.
//
// Run from apps/api: pnpm exec ts-node scripts/backfill-user-worktype-from-avatar.ts
import "dotenv/config";
import { PrismaClient, WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

function workTypeFromAvatarKey(avatarKey: string): WorkplaceType {
  if (avatarKey.startsWith("remote_")) return "HYBRID_REMOTE";
  if (avatarKey.startsWith("service_")) return "SERVICE";
  if (avatarKey.startsWith("manual_")) return "MANUAL_LABOUR";
  return "OFFICE";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { workType: null, avatarKey: { not: null } },
    select: { id: true, avatarKey: true },
  });

  let updated = 0;
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { workType: workTypeFromAvatarKey(u.avatarKey!) },
    });
    updated++;
  }

  console.log(`Backfilled workType for ${updated} of ${users.length} candidate users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it against the dev DB**

```bash
cd apps/api
pnpm exec ts-node scripts/backfill-user-worktype-from-avatar.ts
```
Expected: prints a count ≥ 0 (the seeded owner/admin/Mehmet test accounts should all pick up a `workType` matching their current avatar).

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/backfill-user-worktype-from-avatar.ts
git commit -m "feat(api): backfill User.workType from avatarKey for pre-existing accounts"
```

---

### Task 3: Seed scripts — Sectors and Skills

**Files:**
- Create: `apps/api/scripts/seed-sectors.ts`
- Create: `apps/api/scripts/seed-skills.ts`

**Interfaces:**
- Produces: `Sector` table populated (mirrors `apps/web/src/lib/sectors.ts`'s `SECTORS` list exactly — same `value`/`label`/`workplaceTypes` per row); `Skill` table populated with ~150 hand-curated skill names.

- [ ] **Step 1: Write `seed-sectors.ts`, mirroring `apps/web/src/lib/sectors.ts`'s `SECTORS` array 1:1**

```ts
// DB-backed mirror of apps/web/src/lib/sectors.ts's SECTORS constant —
// kept as a literal copy (not imported, since this script runs against
// apps/api and that file lives in apps/web) so the member-profile Sector
// picker offers the exact same curated taxonomy the company-side Sector
// filter already uses. Delete-all + re-insert on every run — this table is
// 100% authored reference content, never user data.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-sectors.ts
import "dotenv/config";
import { PrismaClient, WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

const SECTORS: { value: string; label: string; workplaceTypes: WorkplaceType[] }[] = [
  { value: "Advertising & Marketing", label: "Advertising & Marketing", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Agriculture", label: "Agriculture", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Archive Management & Storage", label: "Archive Management & Storage", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Automotive", label: "Automotive", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Aviation", label: "Aviation", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Beauty & Personal Care", label: "Beauty & Personal Care", workplaceTypes: ["SERVICE"] },
  { value: "Building & Property Management", label: "Building & Property Management", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Call Center / Customer Support", label: "Call Center / Customer Support", workplaceTypes: ["SERVICE", "HYBRID_REMOTE"] },
  { value: "Chemicals", label: "Chemicals", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Communications Consulting", label: "Communications Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Communities", label: "Communities", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Construction", label: "Construction", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Consulting", label: "Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Courier & Cargo Services", label: "Courier & Cargo Services", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Defense & Aerospace", label: "Defense & Aerospace", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Dental", label: "Dental", workplaceTypes: ["SERVICE"] },
  { value: "Drilling", label: "Drilling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Durable Consumer Goods", label: "Durable Consumer Goods", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "E-commerce", label: "E-commerce", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Education", label: "Education", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Electrical & Electronics", label: "Electrical & Electronics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Energy", label: "Energy", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Entertainment - Culture - Art", label: "Entertainment - Culture - Art", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Environment", label: "Environment", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Event Organization", label: "Event Organization", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Fast-Moving Consumer Goods (FMCG)", label: "Fast-Moving Consumer Goods (FMCG)", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Finance & Economy", label: "Finance & Economy", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Food & Beverage", label: "Food & Beverage", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Forest Products", label: "Forest Products", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Furniture & Accessories", label: "Furniture & Accessories", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Healthcare", label: "Healthcare", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Highway, Tunnel & Bridge Operations", label: "Highway, Tunnel & Bridge Operations", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Household Goods", label: "Household Goods", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Human Resources & Recruitment", label: "Human Resources & Recruitment", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Industry", label: "Industry", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "IT", label: "Information Technology (IT)", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Insurance", label: "Insurance", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Legal Services", label: "Legal Services", workplaceTypes: ["OFFICE"] },
  { value: "Livestock & Animal Husbandry", label: "Livestock & Animal Husbandry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Logistics", label: "Logistics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Manufacturing / Industrial Products", label: "Manufacturing / Industrial Products", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Marine Supply Industry", label: "Marine Supply Industry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Maritime", label: "Maritime", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Media", label: "Media", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Mining & Metals", label: "Mining & Metals", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Office Supplies", label: "Office Supplies", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Printing & Publishing", label: "Printing & Publishing", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Retail", label: "Retail", workplaceTypes: ["SERVICE"] },
  { value: "Security", label: "Security", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Services", label: "Services", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Telecommunications", label: "Telecommunications", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Textile", label: "Textile", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Tourism", label: "Tourism", workplaceTypes: ["SERVICE"] },
  { value: "Trade / Commerce", label: "Trade / Commerce", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Waste Management & Recycling", label: "Waste Management & Recycling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Welding & Cutting Equipment", label: "Welding & Cutting Equipment", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Other", label: "Other", workplaceTypes: ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"] },
];

async function main() {
  await prisma.sector.deleteMany({});
  await prisma.sector.createMany({ data: SECTORS });
  console.log(`Seeded ${SECTORS.length} sectors.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Write `seed-skills.ts` with a curated ~150-skill list**

```ts
// Hand-curated professional skills for the member CV "Skills" picker — NOT
// scraped from LinkedIn (declined per product decision, 2026-09-17: this
// codebase doesn't scrape third-party sites for content it displays as its
// own). Mix of software/technical, trade, language, and soft skills so
// every WorkplaceType has enough real choices. Delete-all + re-insert on
// every run, same convention as seed-sectors.ts.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-skills.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKILLS: string[] = [
  // Software & IT
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "SQL", "React", "Angular",
  "Vue.js", "Node.js", "Next.js", ".NET", "Spring Boot", "Django", "Docker", "Kubernetes", "AWS",
  "Azure", "Google Cloud Platform", "Git", "CI/CD", "DevOps", "Linux Administration", "Cybersecurity",
  "Network Administration", "Database Administration", "Data Analysis", "Data Engineering",
  "Machine Learning", "QA / Software Testing", "UI/UX Design", "Product Management", "Agile / Scrum",
  "API Design", "Mobile Development (iOS)", "Mobile Development (Android)", "WordPress", "SAP",
  "Salesforce", "Microsoft Excel (Advanced)", "Microsoft Office Suite", "Power BI", "Tableau",
  // Finance & Accounting
  "Financial Analysis", "Bookkeeping", "Auditing", "Tax Preparation", "Budgeting & Forecasting",
  "Accounts Payable/Receivable", "SAP FI/CO", "Risk Management", "Investment Analysis", "Payroll",
  // Sales & Marketing
  "Sales", "B2B Sales", "Account Management", "Digital Marketing", "SEO", "SEM / Google Ads",
  "Social Media Management", "Content Writing", "Copywriting", "Email Marketing", "Brand Management",
  "Market Research", "Public Relations", "Negotiation", "Customer Relationship Management (CRM)",
  // HR & Admin
  "Recruitment", "Employee Onboarding", "Performance Management", "HR Policy", "Office Administration",
  "Scheduling", "Data Entry", "Executive Assistance", "Event Planning",
  // Legal
  "Contract Law", "Corporate Law", "Legal Research", "Compliance", "Intellectual Property",
  // Healthcare
  "Patient Care", "Nursing", "First Aid / CPR", "Medical Records Management", "Phlebotomy",
  "Pharmacy Operations", "Physiotherapy", "Dental Assisting",
  // Education
  "Curriculum Development", "Classroom Management", "Tutoring", "Public Speaking", "Training & Facilitation",
  // Hospitality & Food Service
  "Food Preparation", "Barista Skills", "Bartending", "Customer Service", "Restaurant Management",
  "Menu Planning", "Food Safety & Hygiene", "Housekeeping", "Front Desk / Reception",
  // Retail
  "Cash Handling", "Inventory Management", "Merchandising", "Point of Sale (POS) Systems", "Retail Sales",
  // Logistics & Manual Labour
  "Forklift Operation", "Warehouse Management", "Supply Chain Management", "Commercial Driving (E-Class)",
  "Delivery / Courier", "Heavy Equipment Operation", "Welding", "Electrical Wiring", "Plumbing",
  "Carpentry", "Masonry", "HVAC Installation & Repair", "CNC Machine Operation", "Quality Control (Manufacturing)",
  "Occupational Health & Safety", "Rigging & Crane Operation", "Automotive Repair", "Painting (Construction)",
  "Landscaping", "Agriculture / Farming",
  // Security
  "Security Guard Operations", "CCTV Monitoring", "Loss Prevention", "Emergency Response",
  // Languages
  "Turkish (Native)", "English (Fluent)", "German", "French", "Spanish", "Arabic", "Russian", "Italian",
  // Soft skills
  "Leadership", "Team Management", "Problem Solving", "Time Management", "Communication",
  "Conflict Resolution", "Adaptability", "Critical Thinking", "Project Management", "Multitasking",
  "Attention to Detail", "Creativity", "Decision Making", "Customer-Focused Mindset",
];

async function main() {
  await prisma.skill.deleteMany({});
  await prisma.skill.createMany({ data: SKILLS.map((name) => ({ name })), skipDuplicates: true });
  console.log(`Seeded ${new Set(SKILLS).size} unique skills (${SKILLS.length} listed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run both**

```bash
cd apps/api
pnpm exec ts-node scripts/seed-sectors.ts
pnpm exec ts-node scripts/seed-skills.ts
```
Expected: "Seeded 57 sectors." and "Seeded <N> unique skills (<N> listed)." with no duplicate-name errors (if there is a duplicate in the hand-typed list, `skipDuplicates: true` silently drops it — check the printed count against `SKILLS.length` and dedupe the array if they differ).

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/seed-sectors.ts apps/api/scripts/seed-skills.ts
git commit -m "feat(api): seed Sector and Skill lookup tables"
```

---

### Task 4: shared-types — new schemas, faculty-required validation

**Files:**
- Modify: `packages/shared-types/src/schemas/user.ts`
- Create: `packages/shared-types/src/schemas/skill.ts`

**Interfaces:**
- Produces: `skillSchema` (`{id, name}`), `sectorSchema` (`{id, value, label}`), extended `myProfileSchema` (adds `workType`, `sector`, `skills`), extended `updateProfileInputSchema` (adds `workType`, `sectorId`, `skillIds`), `educationHistoryInputSchema`/`updateEducationHistoryInputSchema` reject a COLLEGE row with empty faculty.
- Consumes: `workplaceTypeSchema` from `./workplaceType`.

- [ ] **Step 1: Create `packages/shared-types/src/schemas/skill.ts`**

```ts
import { z } from "zod";
import { workplaceTypeSchema } from "./workplaceType";

// A row from the read-only Skill lookup table (apps/api/prisma/schema.prisma).
// Never free text — always referenced by id, see updateProfileInputSchema's
// skillIds field and ProfileService.updateProfile's existence check.
export const skillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type Skill = z.infer<typeof skillSchema>;

// A row from the read-only Sector lookup table. workplaceTypes travels with
// every row (not trimmed down to just id/value/label) because the Personal
// Information tab's own cascading filter (sectorAppliesTo, in
// apps/web/src/app/me/page.tsx) needs it client-side, the same way
// sectorsForWorkplaceTypes already filters the frontend-only SECTORS
// constant for the (separate, unrelated) company Sector/Industry picker.
// The backend's own check in ProfileService.updateProfile is the real
// enforcement — this is what lets the dropdown narrow itself before the
// member ever submits.
export const sectorSchema = z.object({
  id: z.string().uuid(),
  value: z.string(),
  label: z.string(),
  workplaceTypes: z.array(workplaceTypeSchema),
});
export type Sector = z.infer<typeof sectorSchema>;

// Same cap as the profile's skillIds — mirrored here so GET /sectors and
// GET /skills response-shape assertions (if ever added) share one source.
export const MAX_SKILLS_PER_MEMBER = 10;
```

- [ ] **Step 2: Add `skillIds`'s cap and the two schema-level changes to `educationHistoryInputSchema`/`updateEducationHistoryInputSchema`** (`packages/shared-types/src/schemas/user.ts:78-109`)

Replace the current block (lines 78-109) with:

```ts
export const educationHistoryInputSchema = z
  .object({
    level: eduLevelSchema,
    institutionName: z.string().min(1),
    graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
    // Required whenever level === "COLLEGE" (see the superRefine below) —
    // otherwise optional, since it's meaningless for ELEMENTARY/HIGH_SCHOOL.
    faculty: z.string().min(1).nullable().optional(),
    department: z.string().min(1).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.level === "COLLEGE" && (!v.faculty || v.faculty.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["faculty"],
        message: "Faculty is required for a College entry.",
      });
    }
  });
export type EducationHistoryInput = z.infer<typeof educationHistoryInputSchema>;

// Deliberately does NOT re-run the College/faculty superRefine above: an
// update payload may legitimately omit `level` while patching only
// `graduationYear` on an existing COLLEGE row, and a zod schema has no way
// to see that row's stored level. ProfileService.updateEducationHistory
// re-fetches the existing row and enforces the same rule at the service
// layer instead — see that method's own comment.
export const updateEducationHistoryInputSchema = z
  .object({
    level: eduLevelSchema.optional(),
    institutionName: z.string().min(1).optional(),
    graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
    faculty: z.string().min(1).nullable().optional(),
    department: z.string().min(1).nullable().optional(),
  })
  .refine(
    (v) =>
      v.level !== undefined ||
      v.institutionName !== undefined ||
      v.graduationYear !== undefined ||
      v.faculty !== undefined ||
      v.department !== undefined,
    { message: "Provide at least one field to update" },
  );
export type UpdateEducationHistoryInput = z.infer<typeof updateEducationHistoryInputSchema>;
```

- [ ] **Step 3: Extend `myProfileSchema`** (`packages/shared-types/src/schemas/user.ts:173-200`)

Add `import { workplaceTypeSchema } from "./workplaceType";` and `import { sectorSchema, skillSchema } from "./skill";` to this file's top imports, then add three fields right after `customExperienceText: z.string().nullable(),` (current line 198):

```ts
  workType: workplaceTypeSchema.nullable(),
  sector: sectorSchema.nullable(),
  skills: z.array(skillSchema).max(10),
```

- [ ] **Step 4: Extend `updateProfileInputSchema`** (`packages/shared-types/src/schemas/user.ts:202-236`)

Add three fields to the `.object({...})` block, right after `customExperienceText: z.union([z.string().trim().max(2000), z.literal("")]).optional(),` (current line 221):

```ts
    workType: workplaceTypeSchema.optional(),
    // "" clears the sector back to null, same emptyToNull convention as
    // displayName/customExperienceText above.
    sectorId: z.union([z.string().uuid(), z.literal("")]).optional(),
    skillIds: z.array(z.string().uuid()).max(10).optional(),
```

And add the three new fields to the existing `.refine(...)`'s "at least one field" condition (current lines 224-234), appending `|| v.workType !== undefined || v.sectorId !== undefined || v.skillIds !== undefined` before the closing `,`.

- [ ] **Step 5: Export the new schema file and rebuild**

Add `export * from "./schemas/skill";` to `packages/shared-types/src/index.ts`. Then:
```bash
cd packages/shared-types
pnpm exec tsc
```
Expected: clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/schemas/skill.ts packages/shared-types/src/schemas/user.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add Skill/Sector schemas, workType/sectorId/skillIds fields, faculty-required validation"
```

---

### Task 5: Backend — Skills/Sectors read endpoints

**Files:**
- Create: `apps/api/src/modules/skills/skills.module.ts`
- Create: `apps/api/src/modules/skills/skills.controller.ts`
- Create: `apps/api/src/modules/skills/skills.service.ts`
- Create: `apps/api/src/modules/skills/__tests__/skills.service.test.ts`
- Modify: `apps/api/src/app.module.ts` (register `SkillsModule`)

**Interfaces:**
- Produces: `GET /skills` → `Skill[]` (all rows, `orderBy: { name: "asc" }`), `GET /sectors` → `Sector[]` (all rows, `orderBy: { label: "asc" }`), both `@UseGuards(JwtAuthGuard)` (authenticated members only — same as every other `/me`-adjacent lookup in this app, not public).
- Consumes: `PrismaService` (`../../prisma/prisma.service`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/skills/__tests__/skills.service.test.ts
import { SkillsService } from "../skills.service";

describe("SkillsService", () => {
  it("listSkills returns all skills ordered by name", async () => {
    const prisma = {
      skill: { findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Python" }]) },
      sector: { findMany: jest.fn() },
    } as any;
    const service = new SkillsService(prisma);

    const result = await service.listSkills();

    expect(prisma.skill.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(result).toEqual([{ id: "1", name: "Python" }]);
  });

  it("listSectors returns all sectors ordered by label", async () => {
    const prisma = {
      skill: { findMany: jest.fn() },
      sector: {
        findMany: jest.fn().mockResolvedValue([{ id: "2", value: "IT", label: "Information Technology (IT)" }]),
      },
    } as any;
    const service = new SkillsService(prisma);

    const result = await service.listSectors();

    expect(prisma.sector.findMany).toHaveBeenCalledWith({ orderBy: { label: "asc" } });
    expect(result).toEqual([{ id: "2", value: "IT", label: "Information Technology (IT)" }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec jest skills.service.test.ts`
Expected: FAIL — `Cannot find module '../skills.service'`.

- [ ] **Step 3: Write `skills.service.ts`, `skills.controller.ts`, `skills.module.ts`**

```ts
// apps/api/src/modules/skills/skills.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  listSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: "asc" } });
  }

  listSectors() {
    return this.prisma.sector.findMany({ orderBy: { label: "asc" } });
  }
}
```

```ts
// apps/api/src/modules/skills/skills.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SkillsService } from "./skills.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get("skills")
  listSkills() {
    return this.skills.listSkills();
  }

  @Get("sectors")
  listSectors() {
    return this.skills.listSectors();
  }
}
```

```ts
// apps/api/src/modules/skills/skills.module.ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SkillsController } from "./skills.controller";
import { SkillsService } from "./skills.service";

@Module({
  imports: [PrismaModule],
  controllers: [SkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}
```

Register in `apps/api/src/app.module.ts`: add `import { SkillsModule } from "./modules/skills/skills.module";` and add `SkillsModule` to the `imports` array (mirror how every other feature module — e.g. `ReviewsModule` — is already registered there).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm exec jest skills.service.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/skills apps/api/src/app.module.ts
git commit -m "feat(api): add GET /skills and GET /sectors read endpoints"
```

---

### Task 6: Backend — ProfileService: workType/sectorId/skillIds on updateProfile + getMyProfile, cascading validation, service-layer faculty check

**Files:**
- Modify: `apps/api/src/modules/profile/profile.service.ts`
- Modify: `apps/api/src/modules/profile/profile.controller.ts` (no route changes needed — `updateProfile`/`getProfile` already exist; only the zod schema import needs to still type-check against the Task 4 changes, which it will automatically via `UpdateProfileInput`/`MyProfile`)
- Modify: `apps/api/src/modules/profile/__tests__/profile.service.test.ts` (extend existing test file — confirmed to already exist from the CV-generator work, `apps/api/src/modules/profile/__tests__/profile.service.test.ts`)

**Interfaces:**
- Consumes: `Skill`, `Sector` models (Task 1), `workTypeFromAvatarKey` (existing, `apps/api/src/modules/reviews/randomized-identity.util.ts`), `UpdateProfileInput`/`MyProfile` (Task 4).
- Produces: `ProfileService.updateProfile` accepts and persists `workType`/`sectorId`/`skillIds`, rejecting an 11th skill id (already 400'd by the zod `.max(10)` at the controller's `ZodValidationPipe`, so no extra service-layer check needed there), an unknown skill id (400), and a sector that isn't a child of the effective work-type (400). `ProfileService.getMyProfile` returns `workType`, `sector`, `skills`.

- [ ] **Step 1: Update the existing `getMyProfile` test's mock and write the new failing tests** (in `apps/api/src/modules/profile/__tests__/profile.service.test.ts`)

`getMyProfile`'s existing test (`"getMyProfile returns the three new fields"`, current lines 225-255) will break once Step 3 below adds `userSkill.findMany`/`sector.findUnique` calls inside `getMyProfile` — its mock `prisma` object needs those two methods added now, in the same edit, even though the assertions in that specific `it` don't change. Replace its `const prisma = { ... }` block (current lines 226-245) with:

```ts
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          role: "MEMBER",
          reviewUsername: "Chief Happiness Officer",
          avatarKey: "office_1",
          avatarGradient: "dawn",
          country: "Turkey",
          city: "Istanbul",
          district: null,
          email: "ada@example.com",
          displayName: "Ada",
          isPublicEmployee: true,
          customExperienceText: "Freelance work",
          workType: null,
          sectorId: null,
        }),
      },
      educationHistory: { findMany: jest.fn().mockResolvedValue([]) },
      userSkill: { findMany: jest.fn().mockResolvedValue([]) },
      sector: { findUnique: jest.fn() },
    };
```

Then append a new `describe` block to the end of the file, after the existing `describe("CV profile fields", ...)` block's closing `});`:

```ts
describe("ProfileService.updateProfile — skills/sector/workType", () => {
  const userId = "u1";

  it("rejects a skillId that doesn't exist in the Skill table", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: "OFFICE" }) },
      skill: { findMany: jest.fn().mockResolvedValue([{ id: "real-1" }]) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(
      service.updateProfile(userId, { skillIds: ["real-1", "does-not-exist"] }),
    ).rejects.toThrow("One or more selected skills no longer exist.");
  });

  it("rejects a sectorId whose workplaceTypes doesn't include the effective workType", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: "MANUAL_LABOUR", avatarKey: null }) },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["OFFICE"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateProfile(userId, { sectorId: "sec-1" })).rejects.toThrow(
      "That sector doesn't apply to your selected work type.",
    );
  });

  it("accepts a sectorId that matches the work type submitted in the SAME request", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: null, avatarKey: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["MANUAL_LABOUR"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { workType: "MANUAL_LABOUR", sectorId: "sec-1" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { workType: "MANUAL_LABOUR", sectorId: "sec-1" },
    });
  });

  it("rejects clearing faculty on an existing COLLEGE row via updateEducationHistory", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE" }) },
      educationHistory: {
        findUnique: jest.fn().mockResolvedValue({ id: "e1", userId, level: "COLLEGE", faculty: "Engineering" }),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateEducationHistory(userId, "e1", { faculty: null })).rejects.toThrow(
      "Faculty is required for a College entry.",
    );
  });
});
```

- [ ] **Step 2: Run to verify the four new tests fail (the updated `getMyProfile` test should still pass unchanged)**

Run: `cd apps/api && pnpm exec jest profile.service.test.ts`
Expected: the pre-existing `getMyProfile` test still PASSes (its mock now has the two extra methods, but `getMyProfile` doesn't call them yet); the 4 new tests FAIL, since none of Step 3/4's logic exists yet.

- [ ] **Step 3: Implement the skills/sector/workType logic in `updateProfile`**

Add to the top imports: `import { workTypeFromAvatarKey } from "../reviews/randomized-identity.util";`.

In `updateProfile` (current lines 113-148), insert the following between the existing `if (input.reviewUsername !== undefined && !ALL_ANONYMOUS_USERNAMES.includes(...))` block (ends current line 130) and the `await this.prisma.user.update({` call (current line 132):

```ts
    let skillsUpdate: { deleteMany: object; create: { skillId: string }[] } | undefined;
    if (input.skillIds !== undefined) {
      const existingSkills = await this.prisma.skill.findMany({
        where: { id: { in: input.skillIds } },
        select: { id: true },
      });
      if (existingSkills.length !== input.skillIds.length) {
        throw new BadRequestException("One or more selected skills no longer exist.");
      }
      // Full replace — simplest correct semantics for "the member's current
      // skill set is exactly this list", mirrors how avatarKey/reviewUsername
      // are whole-value replacements too, not incremental diffs.
      skillsUpdate = { deleteMany: {}, create: input.skillIds.map((skillId) => ({ skillId })) };
    }

    let resolvedSectorId: string | null | undefined;
    if (input.sectorId !== undefined) {
      resolvedSectorId = input.sectorId === "" ? null : input.sectorId;
      if (resolvedSectorId) {
        const sector = await this.prisma.sector.findUnique({ where: { id: resolvedSectorId } });
        if (!sector) {
          throw new BadRequestException("That sector doesn't exist.");
        }
        // Falls back to deriving from avatarKey only for an account whose
        // workType has never been set at all (e.g. a brand-new account that
        // hasn't visited Personal Information yet) — every pre-existing
        // account already has workType backfilled (Task 2).
        const effectiveWorkType =
          input.workType ?? user.workType ?? (user.avatarKey ? workTypeFromAvatarKey(user.avatarKey) : null);
        if (!effectiveWorkType || !sector.workplaceTypes.includes(effectiveWorkType)) {
          throw new BadRequestException("That sector doesn't apply to your selected work type.");
        }
      }
    }

```

Then change the `data: { ... }` object inside that same `prisma.user.update` call (current lines 134-146) by adding three lines right before its closing `},` (after the existing `customExperienceText` conditional spread):

```ts
        ...(input.workType !== undefined ? { workType: input.workType } : {}),
        ...(resolvedSectorId !== undefined ? { sectorId: resolvedSectorId } : {}),
        ...(skillsUpdate !== undefined ? { skills: skillsUpdate } : {}),
```

(Prisma's nested `skills: { deleteMany: {}, create: [...] }` works because `User.skills` is the `UserSkill[]` relation on the same `prisma.user.update` call — no separate transaction needed.)

- [ ] **Step 4: Extend `getMyProfile`**

Replace the `Promise.all([...])` call (current lines 80-84) with:

```ts
    const [educationRaw, identity, phoneNumber, userSkills, sector] = await Promise.all([
      this.prisma.educationHistory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      this.piiVault.getMyIdentity(userId),
      this.phoneVerification.getMyPhoneNumber(userId),
      this.prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
      user.sectorId ? this.prisma.sector.findUnique({ where: { id: user.sectorId } }) : Promise.resolve(null),
    ]);
```

Then add three fields to the returned object (current lines 87-110), right after `customExperienceText: user.customExperienceText,` (current line 96):

```ts
      workType: user.workType,
      sector: sector ? { id: sector.id, value: sector.value, label: sector.label, workplaceTypes: sector.workplaceTypes } : null,
      skills: userSkills.map((us) => ({ id: us.skill.id, name: us.skill.name })),
```

- [ ] **Step 5: Add the College/faculty service-layer check to `updateEducationHistory`**

In `updateEducationHistory` (current lines 172-202), insert immediately after the existing ownership check (right after `if (!existing || existing.userId !== userId) { throw new NotFoundException(...); }`, current line 181, and before the `const updated = await this.prisma.educationHistory.update({` call on current line 183) — reusing the `existing` row this method already fetched, not a second query:

```ts

    const effectiveLevel = input.level ?? existing.level;
    const effectiveFaculty = input.faculty !== undefined ? input.faculty : existing.faculty;
    if (effectiveLevel === "COLLEGE" && (!effectiveFaculty || effectiveFaculty.trim().length === 0)) {
      throw new BadRequestException("Faculty is required for a College entry.");
    }
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `cd apps/api && pnpm exec jest profile.service.test.ts`
Expected: PASS, every test in the file including the 4 new ones and the updated `getMyProfile` one.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/profile/profile.service.ts apps/api/src/modules/profile/__tests__/profile.service.test.ts
git commit -m "feat(api): validate and persist workType/sectorId/skillIds; enforce faculty-required on education update"
```

---

### Task 7: Backend — cURL/acceptance verification for the 11-skill-id and College-no-Faculty cases

**Files:**
- None created — manual verification task, run against the live dev API.

**Interfaces:**
- Consumes: the running `apps/api` dev server (`pnpm dev`, port 3001) and a real access token for the seeded Mehmet test account (`mehmet.ahmetoglu.test@iworkedthere.dev`, via `POST /auth/dev-member-login`).

- [ ] **Step 1: Get a dev token**

```bash
curl -s -X POST http://localhost:3001/v1/auth/dev-member-login \
  -H "Content-Type: application/json" \
  -d '{"email":"mehmet.ahmetoglu.test@iworkedthere.dev"}'
```
Expected: 200, JSON body with `accessToken`.

- [ ] **Step 2: Submit 11 skill IDs and confirm 400**

```bash
TOKEN="<accessToken from Step 1>"
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:3001/v1/me/profile \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"skillIds": ["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003","00000000-0000-0000-0000-000000000004","00000000-0000-0000-0000-000000000005","00000000-0000-0000-0000-000000000006","00000000-0000-0000-0000-000000000007","00000000-0000-0000-0000-000000000008","00000000-0000-0000-0000-000000000009","00000000-0000-0000-0000-00000000000a","00000000-0000-0000-0000-00000000000b"]}'
```
Expected: `400`.

- [ ] **Step 3: Submit a COLLEGE education entry with no faculty and confirm 400**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/v1/me/education-history \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"level":"COLLEGE","institutionName":"Test University"}'
```
Expected: `400`.

- [ ] **Step 4: No commit** (verification only — if either check fails, return to Task 6 and fix before proceeding).

---

### Task 8: Frontend — extract `WorkTypePicker`, make `AvatarEditor` dual-mode

**Files:**
- Create: `apps/web/src/components/WorkTypePicker.tsx`
- Modify: `apps/web/src/components/AvatarEditor.tsx`

**Interfaces:**
- Produces: `WorkTypePicker({ value, onChange }: { value: WorkplaceType | null; onChange: (t: WorkplaceType) => void })` — the standalone 4-button grid, usable anywhere.
- `AvatarEditor` gains two new optional props: `workType?: WorkplaceType | null` (controlled value — when provided, the component uses it instead of its own internal state and stops rendering its own picker buttons) and `showWorkTypePicker?: boolean` (defaults to `true` — set to `false` by `/me`'s Customize tab in Task 9; onboarding's `AvatarPicker.tsx` passes neither prop, so its behavior is byte-for-byte unchanged).

- [ ] **Step 1: Create `WorkTypePicker.tsx`, extracted verbatim from `AvatarEditor.tsx`'s current lines 50-66**

```tsx
"use client";

import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";

// The "what kind of work?" 4-button grid — standalone so it can be placed
// anywhere a work-type needs picking (Personal Information tab) without
// dragging AvatarEditor's avatar/background UI along with it. AvatarEditor
// still renders this exact grid itself when uncontrolled (onboarding) — see
// its own doc comment.
export function WorkTypePicker({
  value,
  onChange,
}: {
  value: WorkplaceType | null;
  onChange: (type: WorkplaceType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {WORKPLACE_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`rounded-lg p-2 text-[10px] font-medium transition ${
            value === t.value
              ? "bg-brand-100 ring-2 ring-brand-600 dark:bg-brand-900/60"
              : "text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Modify `AvatarEditor.tsx`** to accept the two new optional props and render `WorkTypePicker` conditionally

Replace lines 15-66 with:

```tsx
export function AvatarEditor({
  avatarKey,
  avatarGradient,
  onChangeAvatarKey,
  onChangeGradient,
  onChangeWorkType,
  workType: controlledWorkType,
  showWorkTypePicker = true,
}: {
  avatarKey: string | null;
  avatarGradient: string | null;
  onChangeAvatarKey: (key: string) => void;
  onChangeGradient: (key: string) => void;
  onChangeWorkType?: (type: WorkplaceType) => void;
  // Controlled value — when provided (by /me's Customize tab, which now
  // sources work-type from the Personal Information tab's own picker
  // instead), this component stops owning its own work-type state and
  // showWorkTypePicker defaults callers toward hiding the redundant grid.
  // Onboarding's AvatarPicker passes neither prop — fully unchanged,
  // internal-state behavior, own grid rendered, exactly as before.
  workType?: WorkplaceType | null;
  showWorkTypePicker?: boolean;
}) {
  const [internalWorkType, setInternalWorkType] = useState<WorkplaceType | null>(avatarWorkType(avatarKey));
  const browsingWorkType = controlledWorkType !== undefined ? controlledWorkType : internalWorkType;
  const colorInputRef = useRef<HTMLInputElement>(null);

  const variants = WORK_TYPE_AVATARS.find((g) => g.workType === browsingWorkType)?.variants ?? [];
  const customColor = customGradientColor(avatarGradient);

  function pickWorkType(type: WorkplaceType) {
    setInternalWorkType(type);
    onChangeWorkType?.(type);
  }

  return (
    <>
      {showWorkTypePicker && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What kind of work?</p>
          <div className="mb-4">
            <WorkTypePicker value={browsingWorkType} onChange={pickWorkType} />
          </div>
        </>
      )}
```

Then leave the rest of the file (the `{browsingWorkType && (...)}` avatar-variant grid and the Background section, current lines 68-133) completely unchanged — only the opening of the function and the top picker block change. Add `import { WorkTypePicker } from "@/components/WorkTypePicker";` to the top imports.

- [ ] **Step 3: Verify onboarding is untouched**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: clean (no type errors — `AvatarPicker.tsx`'s existing call site, which passes neither `workType` nor `showWorkTypePicker`, still type-checks since both are optional).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/WorkTypePicker.tsx apps/web/src/components/AvatarEditor.tsx
git commit -m "refactor(web): extract WorkTypePicker; make AvatarEditor's work-type control dual-mode"
```

---

### Task 9: Frontend — Personal Information tab: Work-Type, cascading Sector, Skills, moved "Information" field

**Files:**
- Modify: `apps/web/src/app/me/page.tsx`
- Create: `apps/web/src/components/profile/SkillsPicker.tsx`

**Interfaces:**
- Consumes: `WorkTypePicker` (Task 8), `GET /skills` and `GET /sectors` (Task 5), `MAX_SKILLS_PER_MEMBER` (Task 4).
- Produces: Personal Information tab shows, in order: Name, Surname, Location, T.C. Kimlik No (unchanged placeholder), Birth date (unchanged), **What kind of work?** (new), **Sector** (new, cascading, Framer Motion reveal), **Skills** (new, ≤10), **Information** (moved here from the CV tab, same `customExperienceText` field, relabeled from "Other work experience"). Customize tab's `AvatarEditor` call becomes controlled (`workType={sharedWorkType} showWorkTypePicker={false}`).

- [ ] **Step 1: Create `SkillsPicker.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { MAX_SKILLS_PER_MEMBER, type Skill } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

// Magnetic-snap hover (a small scale bump that "catches" the cursor) + a
// crisp, high-contrast active state — both pure CSS via Tailwind's
// transition/scale utilities, no extra library needed for an effect this
// small.
export function SkillsPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Skill[]>("/skills")
      .then((data) => {
        if (!cancelled) setAllSkills(data);
      })
      .catch(() => {
        if (!cancelled) setAllSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
      return;
    }
    if (selectedIds.length >= MAX_SKILLS_PER_MEMBER) return;
    onChange([...selectedIds, id]);
  }

  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-widest">Select up to 10 verified skills.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {allSkills.map((skill) => {
          const selected = selectedIds.includes(skill.id);
          const disabled = !selected && selectedIds.length >= MAX_SKILLS_PER_MEMBER;
          return (
            <button
              key={skill.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(skill.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition duration-150 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${
                selected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-border text-muted-foreground hover:border-brand-600 hover:text-foreground"
              }`}
            >
              {skill.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire new state into `/me/page.tsx`**

Add near the other CV-tab state (`displayNameDraft` etc., current lines 92-97):

```ts
  const [workTypeDraft, setWorkTypeDraft] = useState<WorkplaceType | null>(null);
  const [sectorIdDraft, setSectorIdDraft] = useState<string | null>(null);
  const [skillIdsDraft, setSkillIdsDraft] = useState<string[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalStatus, setPersonalStatus] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
```

Add `Sector` and `WorkplaceType` to the existing `import type { ... } from "@iwtr/shared-types"` block, and `import { SkillsPicker } from "@/components/profile/SkillsPicker";`, `import { WorkTypePicker } from "@/components/WorkTypePicker";`, `import { motion, AnimatePresence } from "framer-motion";`.

In `load()` (wherever `profile` is set from the `GET /me/profile` response — find the existing `setProfile(data)`-equivalent line and add immediately after it):

```ts
      setWorkTypeDraft(data.workType);
      setSectorIdDraft(data.sector?.id ?? null);
      setSkillIdsDraft(data.skills.map((s) => s.id));
```

Add a one-time fetch of `/sectors` alongside the page's other on-mount effects:

```ts
  useEffect(() => {
    let cancelled = false;
    apiGet<Sector[]>("/sectors")
      .then((data) => {
        if (!cancelled) setSectors(data);
      })
      .catch(() => {
        if (!cancelled) setSectors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

Add a save handler, mirroring `saveCv`'s shape (current lines 299-320):

```ts
  async function savePersonalWorkInfo() {
    setPersonalSaving(true);
    setPersonalError(null);
    setPersonalStatus(null);
    try {
      await apiPatch("/me/profile", {
        ...(workTypeDraft ? { workType: workTypeDraft } : {}),
        sectorId: sectorIdDraft ?? "",
        skillIds: skillIdsDraft,
        customExperienceText: customExperienceDraft.trim(),
      });
      await load();
      setPersonalStatus("Saved.");
    } catch (err) {
      setPersonalError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setPersonalSaving(false);
    }
  }

  function handleWorkTypeChange(type: WorkplaceType) {
    setWorkTypeDraft(type);
    // A sector from a different work type is no longer valid once the type
    // changes — clear it so the cascading dropdown can't silently keep a
    // stale value the backend would reject on save.
    setSectorIdDraft(null);
  }
```

- [ ] **Step 3: Render the new fields in the Personal Information tab**

Insert this block into the `activeTab === "personal"` section (current lines 659-759), right after the closing `</div>` of the Birth date block (current line 756) and before the section's final `</div>` (current line 757):

```tsx
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">What kind of work?</p>
              <WorkTypePicker value={workTypeDraft} onChange={handleWorkTypeChange} />
            </div>

            <AnimatePresence>
              {workTypeDraft && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  className="mt-4 overflow-hidden border-t border-border pt-4"
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Sector</p>
                  <select
                    value={sectorIdDraft ?? ""}
                    onChange={(e) => setSectorIdDraft(e.target.value || null)}
                    className="w-full rounded-lg border border-slate-800 bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">Select a sector...</option>
                    {sectors
                      .filter((s) => sectorAppliesTo(s, workTypeDraft))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 border-t border-border pt-4">
              <SkillsPicker selectedIds={skillIdsDraft} onChange={setSkillIdsDraft} />
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <label className="text-sm font-medium text-foreground">Information</label>
              <p className="text-xs text-muted-foreground">
                For an employer not in the list on your Education & Work History tab — free text, up to 2000
                characters. Shown on your CV.
              </p>
              <textarea
                maxLength={2000}
                rows={6}
                value={customExperienceDraft}
                onChange={(e) => setCustomExperienceDraft(e.target.value)}
                className="mt-1 w-full rounded-none border border-slate-800 bg-surface px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={savePersonalWorkInfo}
              disabled={personalSaving}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {personalSaving ? "Saving..." : "Save"}
            </button>
            {personalStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{personalStatus}</p>}
            {personalError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{personalError}</p>}
```

`sectorAppliesTo` is a tiny local helper — add it near the file's other local helpers (`eduLevelLabel` etc.). `sectorSchema` already carries `workplaceTypes` on every row (Task 4 Step 1), so this is a direct check, no extra fetch:

```ts
function sectorAppliesTo(sector: Sector, workType: WorkplaceType): boolean {
  return sector.workplaceTypes.includes(workType);
}
```

- [ ] **Step 4: Remove the old "Other work experience" field from the CV tab**

In the `activeTab === "cv"` block (current lines 1195-1277+ after this session's earlier CV-gating work), delete the `<div>` containing the "Other work experience" `<label>`/`<textarea>` (it now lives in Personal Information, Step 3 above) — this was previously right before the "Save CV" button. Leave everything else in that tab (`Display name`, the two contact-disclosure checkboxes, `CvPreview`, the fullscreen modal) exactly as it is.

- [ ] **Step 5: Update Customize tab's `AvatarEditor` call to be controlled**

Change the call at current line 599-605 to:

```tsx
            <AvatarEditor
              avatarKey={avatarKey}
              avatarGradient={avatarGradient}
              onChangeAvatarKey={setAvatarKey}
              onChangeGradient={setAvatarGradient}
              workType={workTypeDraft}
              showWorkTypePicker={false}
            />
```

(Drop the old `onChangeWorkType={(type) => setUsernameCategory(type)}` — `usernameCategory` should now just read `workTypeDraft` directly wherever it's used for filtering the username dropdown's options, since that's the same underlying value; update that one reference accordingly rather than keeping two parallel state variables in sync.)

- [ ] **Step 6: Typecheck and run existing tests**

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm test
```
Expected: clean typecheck; all existing tests still pass (this task touches no test files, but a regression in `/me/page.tsx` could break `AuthModal.test.tsx` transitively only if imports are broken — unlikely, but verify).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/me/page.tsx apps/web/src/components/profile/SkillsPicker.tsx packages/shared-types/src/schemas/skill.ts
git commit -m "feat(web): move work-type picker + add cascading Sector, Skills, and Information field to Personal Information tab"
```

---

### Task 10: Frontend — `HistoryForm.tsx` faculty-required inline validation (onboarding) + `/me` Education tab mirror

**Files:**
- Modify: `apps/web/src/components/onboarding/HistoryForm.tsx`
- Modify: `apps/web/src/app/me/page.tsx` (Education & Work History tab's add/edit forms)

**Interfaces:**
- Produces: both forms block submission and show an inline error when `level === "COLLEGE"` and `faculty` is blank.

- [ ] **Step 1: `HistoryForm.tsx` — add inline validation**

Find the submit handler that builds the `education` array for `historySubmissionSchema` (around current line 142, per the Explore report). Before submission, validate:

```ts
    const collegeMissingFaculty = Object.entries(edu).some(
      ([, row]) => row.level === "COLLEGE" && row.institutionName.trim() !== "" && row.faculty.trim() === "",
    );
    if (collegeMissingFaculty) {
      setError("Faculty is required for a College entry.");
      return;
    }
```

(Adapt variable names to whatever the actual local `edu`/row shape is at that point in the file — the Explore report confirmed the shape is `edu[l.level].faculty`/`.institutionName`, keyed by level; place this check immediately before the existing `apiPost`/`onSubmit` call, using the same `setError`-style state the rest of the form already uses for its other validation messages.) Render the error the same way any other inline error already renders in this file (find the existing error-display JSX pattern and reuse it verbatim — do not invent a new error UI convention for this one field).

- [ ] **Step 2: `/me/page.tsx` Education tab — same check on both add and edit submit handlers**

Find `addEducation`/the add-row submit handler and the edit-row submit handler (both reference `newEduLevel`/`newEduFaculty` and `editEduLevel`/`editEduFaculty` respectively, per the Explore report's line citations ~389/426). Add the same guard immediately before each handler's `apiPost`/`apiPatch` call:

```ts
    if (newEduLevel === "COLLEGE" && newEduFaculty.trim() === "") {
      setError("Faculty is required for a College entry.");
      return;
    }
```
(and the `edit*` equivalent for the edit handler, using `editEduLevel`/`editEduFaculty`/whatever that handler's own error-state setter is called).

- [ ] **Step 3: Manual verification** (Acceptance Criteria's "Validation Test")

Start both dev servers, log in as the Mehmet test account, go to Education & Work History, add a College entry with an institution name but no faculty, click Save. Expected: inline error shown, no network request sent (confirm via the Network tab or by checking no new row appears).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/onboarding/HistoryForm.tsx apps/web/src/app/me/page.tsx
git commit -m "feat(web): block submitting a College education entry with no Faculty (client-side)"
```

---

### Task 11: Frontend — `CvPreview.tsx` restructure (Personal Information → Education → Employment History)

**Files:**
- Modify: `apps/web/src/components/profile/CvPreview.tsx`

**Interfaces:**
- Consumes: `profile.workType`, `profile.sector`, `profile.skills` (Task 4/6), everything else already consumed today (unchanged).
- Produces: CV section order becomes Personal Information (name, avatar, contact line, location, birth date, work type, sector, skills, Information/`customExperienceText`, public-sector badge) → Education → Employment History → footer (unchanged branding footer from the earlier anon-gating/CV session).

- [ ] **Step 1: Replace the component's body** (keep the function signature, imports, `formatRange`, `EDU_LEVEL_LABELS`, `formatEducationDetail` helpers exactly as they are today — only the JSX inside `return (...)` changes)

```tsx
  return (
    <div
      id={id}
      className={`relative flex w-full flex-col border border-[#1e293b] bg-[#fafafa] p-6 font-jakarta text-[#0f172a] dark:bg-[#fafafa] dark:text-[#0f172a]${
        forPrint ? "" : " aspect-[1/1.414] overflow-y-auto"
      }`}
    >
      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">
          Personal Information
        </h2>
        <div className="mt-3 flex items-center space-x-4">
          <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
          <div className="min-w-0">
            <h1 className="truncate font-grotesk text-2xl font-bold leading-tight">{name}</h1>
            {contactLine && <p className="truncate text-sm text-[#475569]">{contactLine}</p>}
            {locationLine && <p className="truncate text-sm text-[#475569]">{locationLine}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#475569]">
          {profile.birthDate && <span>Born {new Date(profile.birthDate).getFullYear()}</span>}
          {workTypeLabel && <span>{workTypeLabel}</span>}
          {profile.sector && <span>{profile.sector.label}</span>}
        </div>
        {profile.isPublicEmployee && (
          <span className="mt-2 inline-block rounded-none border border-[#1e293b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Public Sector Employee
          </span>
        )}
        {profile.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.skills.map((s) => (
              <span key={s.id} className="rounded-full border border-[#1e293b] px-2 py-0.5 text-[11px] font-medium">
                {s.name}
              </span>
            ))}
          </div>
        )}
        {profile.customExperienceText && (
          <p className="mt-3 whitespace-pre-wrap text-sm">{profile.customExperienceText}</p>
        )}
      </section>

      <hr className="my-8 border-t border-[#1e293b]" />

      {education.length > 0 && (
        <>
          <section>
            <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">Education</h2>
            <ul className="mt-2 flex flex-col space-y-2">
              {education.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-bold">{e.institutionName}</p>
                  <p className="text-xs text-[#475569]">
                    {formatEducationDetail(e.level, e.faculty, e.department, e.graduationYear)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <hr className="my-8 border-t border-[#1e293b]" />
        </>
      )}

      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-[#475569]">Employment History</h2>
        <ul className="mt-2 flex flex-col space-y-2">
          {employment.length === 0 && <li className="text-sm text-[#64748b]">Nothing added yet.</li>}
          {employment.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-bold">{e.jobTitle ?? "Employee"} — {e.rawCompanyName}</p>
              <p className="text-xs text-[#475569]">{formatRange(e.startDate, e.endDate)}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 flex flex-col items-start border-t border-[#1e293b] pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- snapshotted by html2canvas, which can't resolve next/image's optimized/lazy output */}
        <img src="/realicon.png" alt="I Worked There" className="h-6 w-6" />
        <p className="mt-1 text-[10px] font-bold text-[#0f172a]">Made in iworkedthere.com</p>
      </footer>
    </div>
  );
}
```

Add a `workTypeLabel` local const right before the `return`, next to the existing `locationLine`/`contactLine` consts:

```ts
  const WORK_TYPE_LABELS: Record<string, string> = {
    OFFICE: "Office",
    HYBRID_REMOTE: "Hybrid/Remote",
    SERVICE: "Service",
    MANUAL_LABOUR: "Manual Labour",
  };
  const workTypeLabel = profile.workType ? WORK_TYPE_LABELS[profile.workType] : null;
```

(Note: this removes the previous separate "Notes" section this session's earlier CV work introduced — `customExperienceText` now renders inside Personal Information per this newer, more specific spec, superseding that placement. No dedicated stark `<hr>` is needed around the "Information" text itself since it's inside the Personal Information section, not a section of its own — only between the three top-level sections.)

- [ ] **Step 2: Typecheck**

```bash
cd apps/web
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/profile/CvPreview.tsx
git commit -m "feat(web): restructure CV into Personal Information > Education > Employment History"
```

---

### Task 12: Full-branch verification against all 4 acceptance criteria

**Files:** none — verification only.

- [ ] **Step 1: Security Check** — repeat Task 7 Step 2 (11 skill IDs → 400). Already covered; re-run once more against the fully-integrated branch to confirm nothing in Tasks 8-11 regressed it.

- [ ] **Step 2: Validation Test** — repeat Task 10 Step 3 live in the browser (College + no Faculty → inline error, no submission) on both onboarding's `HistoryForm` (a fresh test registration) and `/me`'s Education tab (Mehmet test account).

- [ ] **Step 3: Functional Test** — in the browser, on `/me`'s Personal Information tab: select a Work-Type, confirm the Sector `<select>` animates open and lists only sectors tagged with that type; change Work-Type; confirm the previously-selected Sector clears and the list re-filters.

- [ ] **Step 4: UI Verification** — Save a profile with Skills, Sector, and an Information note set; open the CV fullscreen view (or generate a real PDF via a job Apply, as this session already did for the earlier CV layout fix); confirm the rendered section order is exactly Personal Information → Education → Employment History, and that the Information text appears inside the Personal Information block, not a separate section and not inside Employment History.

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/api && pnpm test
cd apps/web && pnpm test
```
Expected: all suites pass except the already-documented pre-existing/unrelated `workplace-classifier` and `jobPosting`/`savedJobPosting` failures (see `project_iwtr_cv_generator_inprogress` memory — those are known, unrelated to this branch).

- [ ] **Step 6: Lint both apps**

```bash
cd apps/api && pnpm lint
cd apps/web && pnpm lint
```
Expected: 0 errors (warnings at or below this branch's starting baseline).

- [ ] **Step 7: Final commit / hand off to `finishing-a-development-branch`** — no code change, just confirms the branch is green and ready for the merge-menu skill.

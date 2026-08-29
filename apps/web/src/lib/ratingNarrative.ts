import type { CategoryKey, VibeFlag, WorkplaceType } from "@iwtr/shared-types";

// Score/work-type/flags -> {image, text} mapping for the company page's
// "Dynamic Rating Visuals" box. Text is generated, not fixed prose per
// tier — hand-written copy read the same for every company at a given
// score/type, which didn't come out accurate (a 4.2-star office with great
// leadership but bad infrastructure got the exact same paragraph as one
// with the opposite problem). Instead this builds the paragraph from the
// company's own real Workplace Vibe Flags (WorkplaceVibeFlags.tsx / GET
// /companies/:slug/vibe-flags): one clause per category, picked from
// whether that category's 2 flags actually came back GREEN or RED for THIS
// company, plus a tier-framed opening sentence for the overall star level.
//
// The clause never repeats a flag chip's exact chart label (e.g. "Customer
// Is Always Right" the chip, vs. "a policy that always sides with the
// customer over staff" the sentence here) — this box's job is to summarize
// the company in prose, not to re-print what the chips beside it already
// say verbatim. FLAG_PARAPHRASE below is the pattern table: it's keyed by
// work-type then by the flag's own exact label (see MASTER_FLAG_CHART in
// flag-calculator.service.ts, which this must stay in sync with), and holds
// one reworded clause per flag — covering every green/red flag for every
// work-type, so any category/cluster combination the engine can resolve to
// always has a paraphrase ready.
type ScoreTier = "unsatisfactory" | "developing" | "effective" | "highlyEffective" | "exemplary";

const WORKPLACE_IMAGE_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "hybrid",
  SERVICE: "service",
  MANUAL_LABOUR: "manuallabour",
};

// Same [min, max) boundaries as shared-types/company.ts's scoreBands (0-2.0
// Unsatisfactory / 2.0-3.0 Developing / 3.0-4.0 Effective / 4.0-5.0 Superb /
// exactly 5.0 Exemplary) — "4.0 to 4.9" in the product copy just means "the
// whole top tier short of a perfect 5.0".
function scoreTier(score: number): ScoreTier {
  if (score >= 5.0) return "exemplary";
  if (score >= 4.0) return "highlyEffective";
  if (score >= 3.0) return "effective";
  if (score >= 2.0) return "developing";
  return "unsatisfactory";
}

const TIER_IMAGE_NUMBER: Record<Exclude<ScoreTier, "exemplary">, number> = {
  unsatisfactory: 1,
  developing: 2,
  effective: 3,
  highlyEffective: 4,
};

// Overall framing sentence, picked by [work-type][tier] — the one place
// star-level still speaks directly, since a category-by-category paragraph
// alone never says how the workplace reads as a whole. 4 work-types x 5
// tiers = 20 distinct opening sentences, each already work-type-flavored on
// its own (not a single sentence with a noun swapped in), per "make it for
// every work-type and every rating".
const TIER_OPENING: Record<WorkplaceType, Record<ScoreTier, string>> = {
  OFFICE: {
    unsatisfactory: "Reviewers describe this office as struggling badly across the board.",
    developing: "Reviewers describe this office as inconsistent — real strengths undercut by ongoing weak spots.",
    effective: "Reviewers describe this office as solid and dependable across most areas.",
    highlyEffective: "Reviewers describe this office as performing strongly across nearly every area they assessed.",
    exemplary: "Reviewers describe this office as exemplary, excelling across every area they assessed.",
  },
  HYBRID_REMOTE: {
    unsatisfactory: "Reviewers describe this remote/hybrid team as struggling badly across the board.",
    developing:
      "Reviewers describe this remote/hybrid team as inconsistent — real strengths undercut by ongoing weak spots.",
    effective: "Reviewers describe this remote/hybrid team as solid and dependable across most areas.",
    highlyEffective:
      "Reviewers describe this remote/hybrid team as performing strongly across nearly every area they assessed.",
    exemplary: "Reviewers describe this remote/hybrid team as exemplary, excelling across every area they assessed.",
  },
  SERVICE: {
    unsatisfactory: "Reviewers describe this service floor as struggling badly across the board.",
    developing: "Reviewers describe this service floor as inconsistent — real strengths undercut by ongoing weak spots.",
    effective: "Reviewers describe this service floor as solid and dependable across most areas.",
    highlyEffective: "Reviewers describe this service floor as performing strongly across nearly every area they assessed.",
    exemplary: "Reviewers describe this service floor as exemplary, excelling across every area they assessed.",
  },
  MANUAL_LABOUR: {
    unsatisfactory: "Reviewers describe this job site as struggling badly across the board.",
    developing: "Reviewers describe this job site as inconsistent — real strengths undercut by ongoing weak spots.",
    effective: "Reviewers describe this job site as solid and dependable across most areas.",
    highlyEffective: "Reviewers describe this job site as performing strongly across nearly every area they assessed.",
    exemplary: "Reviewers describe this job site as exemplary, excelling across every area they assessed.",
  },
};

// Category order matches WorkplaceVibeFlags.tsx's ROW_ORDER, so the
// paragraph's clause order matches the flag chips' own display order.
const CATEGORY_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "Corporate culture",
  leadership: "Leadership",
  infrastructure: "Infrastructure and resources",
  workLifeBalance: "Work-life balance",
  stability: "Organizational stability",
};

// Reworded clause for every flag chip label MASTER_FLAG_CHART can produce,
// keyed by work-type then by the flag's own exact label. Written as a
// lowercase noun-phrase fragment so the same entry drops cleanly into any
// of the 3 sentence shapes categoryClause() below builds (after "thanks
// to", after "marked by", or standing alone as "X is a real plus").
const FLAG_PARAPHRASE: Record<WorkplaceType, Record<string, string>> = {
  OFFICE: {
    "Collaborative Team": "colleagues who genuinely work well together",
    "Ethical Leadership": "managers who lead with real integrity",
    "Toxic Backstabbing": "coworkers who quietly undermine one another",
    "Hypocritical Leadership": "leaders who don't practice what they preach",
    "Accountable Managers": "managers who own their mistakes instead of dodging them",
    "Actionable Feedback": "feedback that actually helps people improve",
    "Blames Subordinates": "a habit of pinning failures on junior staff",
    "Extreme Micromanagement": "supervisors hovering over every small task",
    "Modern Equipment": "up-to-date gear that doesn't slow anyone down",
    "Fast IT Support": "tech issues that get resolved quickly",
    "Outdated Tech": "aging equipment that's overdue for replacement",
    "Neglected Maintenance": "facilities upkeep that keeps getting put off",
    "Paid Overtime": "extra hours that are actually compensated",
    "Disconnect After Hours": "evenings and weekends left free of work messages",
    "Unpaid Overtime Expected": "extra hours staff are expected to eat for free",
    "After-Hours Pressure": "messages that keep arriving well past the workday",
    "High Job Security": "roles that feel genuinely safe long-term",
    "Predictable Promotions": "a promotion path people can actually count on",
    "High Turnover": "colleagues who keep leaving faster than expected",
    "Chaotic Layoffs": "job cuts that land with little warning or order",
  },
  HYBRID_REMOTE: {
    "Trust Without Tracking": "leadership that trusts people without watching every move",
    "Timezones Respected": "meetings scheduled with everyone's hours in mind",
    "Surveillance Software": "activity-tracking tools monitoring every keystroke",
    "Ignored Timezones": "calls booked without regard for who's asleep",
    "Outcome-Based Evaluation": "managers who judge people by results, not online status",
    "Proactive Burnout Care": "leaders who step in before workloads become overwhelming",
    "Status Icon Tracking": "managers fixated on whether the green dot is lit",
    "Burnout Ignored": "exhaustion that goes unaddressed until people quit",
    "Hardware Stipend": "a real budget for home-office equipment",
    "Reliable Cloud Access": "systems that stay online when people need them",
    "Forced Personal Tech": "staff expected to use their own devices for work",
    "Unreliable Remote Access": "remote systems that constantly drop out",
    "Enforced Disconnect": "clear boundaries once the workday ends",
    "Manageable Workload": "a pace of work that doesn't spiral out of control",
    "Blurred Unpaid Hours": "work hours that quietly bleed into personal time",
    "Pointless RTO Mandates": "in-office days demanded with no real reason",
    "Equal Remote Pay": "pay that doesn't shrink just for working remotely",
    "Secure Remote Policy": "a remote-work policy people can actually rely on",
    "Remote Pay Penalties": "salaries quietly cut for working off-site",
    "Constant RTO Threats": "a return-to-office mandate that always seems imminent",
  },
  SERVICE: {
    "Defends Staff From Customers": "management that backs employees against abusive customers",
    "Realistic Speed Targets": "service targets that are actually achievable",
    "Customer Is Always Right": "a policy that always sides with the customer over staff",
    "Dangerous Service Shortcuts": "corners cut on safety to move faster",
    "Hands-On Management": "supervisors who jump in on the floor when it's busy",
    "Impartial Scheduling": "shifts assigned fairly without favorites",
    "Absent During Peaks": "managers nowhere to be found during the rush",
    "Supervisor Favoritism": "shift leads who visibly play favorites",
    "Reliable Service Tech": "point-of-sale and service systems that hold up",
    "Sanitary Break Areas": "break rooms kept genuinely clean",
    "Crashing POS Systems": "checkout systems that keep going down",
    "Neglected Break Zones": "break areas nobody bothers to maintain",
    "Advanced Schedule Notice": "shift schedules posted well ahead of time",
    "Voluntary Overtime": "extra shifts that stay optional, not forced",
    "Last-Minute Shift Changes": "schedules that get rearranged with almost no notice",
    "Forced Clopening Shifts": "closing one night then opening again the next morning",
    "100% Accurate Wages": "paychecks that always add up correctly",
    "Fully Staffed Shifts": "shifts that reliably have enough people on the floor",
    "Wage & Tip Theft": "pay and tips that don't fully make it to staff",
    "Constant Understaffing": "shifts routinely running short-handed",
  },
  MANUAL_LABOUR: {
    "Health & Safety First": "a culture that puts physical safety before deadlines",
    "Respectful Site Culture": "a crew environment free of harassment and hazing",
    "Speed Over Safety": "production speed pushed ahead of safe practice",
    "Toxic Machismo & Hazing": "a culture of hazing and toxic machismo on site",
    "Experienced Foremen": "foremen with real hands-on experience running the crew",
    "Immediate Hazard Resolution": "reported hazards that get fixed right away",
    "Inexperienced Management": "site leads without enough hands-on experience",
    "Unsafe Conditions Ignored": "known hazards that go unaddressed",
    "Safe Heavy Machinery": "machinery that's properly maintained and safe to run",
    "Free Required PPE": "required safety gear supplied at no cost",
    "Unsafe Equipment": "machinery that's poorly maintained and risky to operate",
    "PPE Not Provided": "safety gear workers have to source themselves",
    "Enforced Hydration Breaks": "water and rest breaks that are actually enforced",
    "Safe Shift Durations": "shift lengths that stay within a safe range",
    "Denied Rest & Water": "rest and water breaks that get denied or skipped",
    "Exhausting Shift Lengths": "shifts stretched long past the point of safety",
    "Accurate Hazard Pay": "hazard pay that's calculated correctly and paid on time",
    "Consistent Year-Round Work": "steady work that doesn't dry up seasonally",
    "Missing Hazard Pay": "hazard pay that's shorted or skipped entirely",
    "Chaotic Hire-and-Fire": "a crew that gets hired and let go with no consistency",
  },
};

function paraphrase(workplaceType: WorkplaceType, flag: VibeFlag): string {
  return FLAG_PARAPHRASE[workplaceType][flag.label] ?? flag.label.toLowerCase();
}

// The pattern: one template per category per resolved state, filled with
// that category's 2 flags reworded via FLAG_PARAPHRASE — never the raw chip
// label. A category is GREEN only when both its clusters came back GREEN,
// RED only when both came back RED, otherwise MIXED (one of each) —
// mirroring how the flag chips themselves render (2 flags per category,
// independently resolved).
function categoryClause(workplaceType: WorkplaceType, categoryLabel: string, flags: VibeFlag[]): string | null {
  const byCluster = [...flags].sort((a, b) => a.cluster - b.cluster);
  if (byCluster.length < 2) return null;
  const [c1, c2] = byCluster;
  const p1 = paraphrase(workplaceType, c1);
  const p2 = paraphrase(workplaceType, c2);

  if (c1.color === "GREEN" && c2.color === "GREEN") {
    return `${categoryLabel} is a genuine strength here, thanks to ${p1} and ${p2}.`;
  }
  if (c1.color === "RED" && c2.color === "RED") {
    return `${categoryLabel} is a serious weak point, marked by ${p1} and ${p2}.`;
  }
  const green = c1.color === "GREEN" ? p1 : p2;
  const red = c1.color === "RED" ? p1 : p2;
  return `${categoryLabel} is mixed here: ${green} is a real plus, but ${red} still holds it back.`;
}

function generateText(tier: ScoreTier, workplaceType: WorkplaceType, flags: VibeFlag[]): string {
  const opening = TIER_OPENING[workplaceType][tier];
  const clauses = CATEGORY_ORDER.map((category) =>
    categoryClause(
      workplaceType,
      CATEGORY_LABELS[category],
      flags.filter((f) => f.category === category),
    ),
  ).filter((c): c is string => c !== null);

  if (clauses.length === 0) {
    return `${opening} No category-by-category detail is available yet for this work-type.`;
  }
  return [opening, ...clauses].join(" ");
}

export interface RatingNarrative {
  // null only for the exemplary (perfect 5.0) tier — no artwork exists for
  // it yet, a placeholder is shown in its place until one is added.
  imageSrc: string | null;
  text: string;
}

// flags: this company's real vibe flags for `workplaceType` (empty when it
// has no published reviews yet under that type) — see page.tsx, which
// fetches GET /companies/:slug/vibe-flags server-side and passes the
// matching workplaceType's section in.
export function ratingNarrative(score: number, workplaceType: WorkplaceType, flags: VibeFlag[]): RatingNarrative {
  const tier = scoreTier(score);
  const text = generateText(tier, workplaceType, flags);
  if (tier === "exemplary") return { imageSrc: null, text };

  const prefix = WORKPLACE_IMAGE_PREFIX[workplaceType];
  const imageSrc = `/${prefix}${TIER_IMAGE_NUMBER[tier]}.png`;
  return { imageSrc, text };
}

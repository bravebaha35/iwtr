import type { SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";

// Maps company-level survey consensus (GET /companies/:slug/survey-stats —
// per-question agree/disagree tallies, never the literal YES/NO breakdown or
// which choice was "correct", see surveyQuestionStatsSchema in
// packages/shared-types/src/schemas/review.ts) onto the 80-flag system (10
// green + 10 red per work-type) supplied by product. Every rule below is
// keyed to "AGREE" (majority answered this question's healthy/correct way)
// or "DISAGREE" (majority didn't) rather than to a literal YES/NO, because
// the API deliberately never exposes which literal answer was correct — only
// apps/api/src/modules/reviews/survey-questions.data.ts (server-only) knows
// that. Each rule's AGREE/DISAGREE was derived by comparing the literal
// answer product specified against that question's actual stored
// correctAnswer in survey-questions.data.ts, not by re-deriving a "healthy"
// answer from the question's wording — so this stays numerically correct
// against the live aggregate even for the couple of questions where that
// stored correctAnswer reads as counterintuitive.

type FlagTrigger = "AGREE" | "DISAGREE";
type FlagKind = "green" | "red";

interface FlagRule {
  questionId: string;
  trigger: FlagTrigger;
  kind: FlagKind;
  flag: string;
  points: number;
}

export interface TriggeredFlag {
  flag: string;
  points: number;
}

export interface WorkplaceVibeFlags {
  green: TriggeredFlag[];
  red: TriggeredFlag[];
}

// A flag earned from just one 1-point question is too weak a signal to
// surface on its own — with only a handful of reviews, nearly every question
// clears its own majority one way, which used to flood both columns with
// almost the entire 10-flag pool. Only a flag that's reached two-question
// agreement (or comes from a question explicitly worth two points alone) is
// notable enough to show. No fixed display cap either — however many clear
// the bar, in strength order.
const MIN_POINTS_TO_DISPLAY = 2;

const OFFICE_RULES: FlagRule[] = [
  // Corporate Culture
  { questionId: "OFFICE.corporateCulture.1", trigger: "AGREE", kind: "red", flag: "Unrelevant work force.", points: 1 },
  { questionId: "OFFICE.corporateCulture.2", trigger: "DISAGREE", kind: "red", flag: "Backstabbing common.", points: 1 },
  { questionId: "OFFICE.corporateCulture.2", trigger: "AGREE", kind: "green", flag: "Leaders practice values.", points: 1 },
  { questionId: "OFFICE.corporateCulture.3", trigger: "AGREE", kind: "green", flag: "Open criticism allowed.", points: 1 },
  { questionId: "OFFICE.corporateCulture.4", trigger: "AGREE", kind: "green", flag: "Leaders practice values.", points: 1 },
  { questionId: "OFFICE.corporateCulture.4", trigger: "AGREE", kind: "green", flag: "Open criticism allowed.", points: 1 },
  { questionId: "OFFICE.corporateCulture.4", trigger: "AGREE", kind: "red", flag: "Unrelevant work force.", points: 1 },
  { questionId: "OFFICE.corporateCulture.5", trigger: "DISAGREE", kind: "red", flag: "Backstabbing common.", points: 1 },
  // Leadership & Management
  { questionId: "OFFICE.leadership.1", trigger: "AGREE", kind: "red", flag: "Active micromanagement.", points: 1 },
  { questionId: "OFFICE.leadership.2", trigger: "DISAGREE", kind: "red", flag: "Unprotected from workload.", points: 1 },
  { questionId: "OFFICE.leadership.2", trigger: "AGREE", kind: "green", flag: "Leaders take blame.", points: 1 },
  { questionId: "OFFICE.leadership.3", trigger: "DISAGREE", kind: "red", flag: "Active micromanagement.", points: 1 },
  { questionId: "OFFICE.leadership.3", trigger: "AGREE", kind: "green", flag: "Constructive feedback.", points: 1 },
  { questionId: "OFFICE.leadership.4", trigger: "AGREE", kind: "green", flag: "Constructive feedback.", points: 1 },
  { questionId: "OFFICE.leadership.5", trigger: "DISAGREE", kind: "red", flag: "Unprotected from workload.", points: 1 },
  { questionId: "OFFICE.leadership.5", trigger: "AGREE", kind: "green", flag: "Leaders take blame.", points: 1 },
  // Infrastructure & Resources
  { questionId: "OFFICE.infrastructure.1", trigger: "AGREE", kind: "green", flag: "Timely IT resolutions.", points: 1 },
  { questionId: "OFFICE.infrastructure.1", trigger: "DISAGREE", kind: "red", flag: "Outdated hardware.", points: 1 },
  { questionId: "OFFICE.infrastructure.2", trigger: "AGREE", kind: "green", flag: "Quiet environment.", points: 2 },
  { questionId: "OFFICE.infrastructure.3", trigger: "DISAGREE", kind: "red", flag: "Neglected equipment.", points: 1 },
  { questionId: "OFFICE.infrastructure.4", trigger: "DISAGREE", kind: "red", flag: "Outdated hardware.", points: 1 },
  { questionId: "OFFICE.infrastructure.5", trigger: "AGREE", kind: "green", flag: "Timely IT resolutions.", points: 1 },
  { questionId: "OFFICE.infrastructure.5", trigger: "DISAGREE", kind: "red", flag: "Neglected equipment.", points: 1 },
  // Work-Life Balance
  { questionId: "OFFICE.workLifeBalance.1", trigger: "AGREE", kind: "green", flag: "Uncontacted PTO.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.1", trigger: "DISAGREE", kind: "red", flag: "After-hours replies expected.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.2", trigger: "DISAGREE", kind: "red", flag: "Uncompensated overtime.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.3", trigger: "AGREE", kind: "green", flag: "Uncontacted PTO.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.3", trigger: "DISAGREE", kind: "red", flag: "After-hours replies expected.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.4", trigger: "AGREE", kind: "green", flag: "Flexible appointments.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.4", trigger: "DISAGREE", kind: "red", flag: "Uncompensated overtime.", points: 1 },
  { questionId: "OFFICE.workLifeBalance.5", trigger: "AGREE", kind: "green", flag: "Flexible appointments.", points: 1 },
  // Organizational Stability
  { questionId: "OFFICE.stability.1", trigger: "DISAGREE", kind: "red", flag: "High turnover", points: 1 },
  { questionId: "OFFICE.stability.1", trigger: "AGREE", kind: "green", flag: "Funded career growth", points: 1 },
  { questionId: "OFFICE.stability.2", trigger: "DISAGREE", kind: "red", flag: "Chaotic strategic pivots", points: 1 },
  { questionId: "OFFICE.stability.2", trigger: "AGREE", kind: "green", flag: "Predictable salary reviews", points: 1 },
  { questionId: "OFFICE.stability.3", trigger: "AGREE", kind: "green", flag: "Predictable salary reviews", points: 1 },
  { questionId: "OFFICE.stability.4", trigger: "DISAGREE", kind: "red", flag: "High turnover", points: 1 },
  { questionId: "OFFICE.stability.4", trigger: "AGREE", kind: "green", flag: "Funded career growth", points: 1 },
  { questionId: "OFFICE.stability.5", trigger: "DISAGREE", kind: "red", flag: "Chaotic strategic pivots", points: 1 },
];

const HYBRID_REMOTE_RULES: FlagRule[] = [
  // Corporate Culture
  { questionId: "HYBRID_REMOTE.corporateCulture.1", trigger: "AGREE", kind: "green", flag: "Trust without tracking", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.1", trigger: "DISAGREE", kind: "red", flag: "Social penalties.", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.2", trigger: "DISAGREE", kind: "red", flag: "In-office favoritism", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.3", trigger: "AGREE", kind: "green", flag: "Trust without tracking", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.4", trigger: "DISAGREE", kind: "red", flag: "In-office favoritism", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.4", trigger: "AGREE", kind: "green", flag: "Timezones respected", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.5", trigger: "DISAGREE", kind: "red", flag: "Social penalties.", points: 1 },
  { questionId: "HYBRID_REMOTE.corporateCulture.5", trigger: "AGREE", kind: "green", flag: "Timezones respected", points: 1 },
  // Leadership & Management
  { questionId: "HYBRID_REMOTE.leadership.1", trigger: "AGREE", kind: "green", flag: "Outcome-based evaluations.", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.1", trigger: "DISAGREE", kind: "red", flag: "Unresponsive managers", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.2", trigger: "AGREE", kind: "green", flag: "Team work", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.2", trigger: "DISAGREE", kind: "red", flag: "Unstructured virtual meetings", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.3", trigger: "DISAGREE", kind: "red", flag: "Unresponsive managers", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.4", trigger: "AGREE", kind: "green", flag: "Team work", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.5", trigger: "AGREE", kind: "green", flag: "Outcome-based evaluations.", points: 1 },
  { questionId: "HYBRID_REMOTE.leadership.5", trigger: "DISAGREE", kind: "red", flag: "Unstructured virtual meetings", points: 1 },
  // Infrastructure & Resources
  { questionId: "HYBRID_REMOTE.infrastructure.1", trigger: "AGREE", kind: "green", flag: "High-quality hardware stipend", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.1", trigger: "DISAGREE", kind: "red", flag: "Chaotic digital tools", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.2", trigger: "AGREE", kind: "green", flag: "Reliable cloud tools.", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.2", trigger: "DISAGREE", kind: "red", flag: "Unclear documentation.", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.3", trigger: "DISAGREE", kind: "red", flag: "Unclear documentation.", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.4", trigger: "AGREE", kind: "green", flag: "Reliable cloud tools.", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.5", trigger: "DISAGREE", kind: "red", flag: "Chaotic digital tools", points: 1 },
  { questionId: "HYBRID_REMOTE.infrastructure.5", trigger: "AGREE", kind: "green", flag: "High-quality hardware stipend", points: 1 },
  // Work-Life Balance
  { questionId: "HYBRID_REMOTE.workLifeBalance.1", trigger: "DISAGREE", kind: "red", flag: "Blurred unpaid hours", points: 1 },
  { questionId: "HYBRID_REMOTE.workLifeBalance.2", trigger: "AGREE", kind: "green", flag: "Right to disconnect", points: 1 },
  { questionId: "HYBRID_REMOTE.workLifeBalance.3", trigger: "DISAGREE", kind: "red", flag: "Blurred unpaid hours", points: 1 },
  { questionId: "HYBRID_REMOTE.workLifeBalance.3", trigger: "AGREE", kind: "green", flag: "Right to disconnect", points: 1 },
  { questionId: "HYBRID_REMOTE.workLifeBalance.4", trigger: "AGREE", kind: "green", flag: "Manageable workloads", points: 1 },
  { questionId: "HYBRID_REMOTE.workLifeBalance.5", trigger: "DISAGREE", kind: "red", flag: "Pointless in-office days", points: 1 },
  // Organizational Stability
  { questionId: "HYBRID_REMOTE.stability.1", trigger: "DISAGREE", kind: "red", flag: "RTO threats", points: 1 },
  { questionId: "HYBRID_REMOTE.stability.2", trigger: "DISAGREE", kind: "red", flag: "RTO threats", points: 1 },
  { questionId: "HYBRID_REMOTE.stability.2", trigger: "AGREE", kind: "green", flag: "Equal remote pay", points: 1 },
  { questionId: "HYBRID_REMOTE.stability.3", trigger: "AGREE", kind: "green", flag: "Equal remote pay", points: 1 },
  { questionId: "HYBRID_REMOTE.stability.4", trigger: "AGREE", kind: "green", flag: "Transparent financial updates", points: 1 },
  { questionId: "HYBRID_REMOTE.stability.5", trigger: "DISAGREE", kind: "red", flag: "Sudden offshoring", points: 2 },
  { questionId: "HYBRID_REMOTE.stability.5", trigger: "AGREE", kind: "green", flag: "Transparent financial updates", points: 1 },
];

const SERVICE_RULES: FlagRule[] = [
  // Corporate Culture
  { questionId: "SERVICE.corporateCulture.1", trigger: "AGREE", kind: "green", flag: "Management backs workers", points: 1 },
  { questionId: "SERVICE.corporateCulture.2", trigger: "AGREE", kind: "green", flag: "Realistic speed targets", points: 1 },
  { questionId: "SERVICE.corporateCulture.2", trigger: "DISAGREE", kind: "red", flag: "Toxic floor environment", points: 1 },
  { questionId: "SERVICE.corporateCulture.3", trigger: "AGREE", kind: "green", flag: "Realistic speed targets", points: 1 },
  { questionId: "SERVICE.corporateCulture.4", trigger: "DISAGREE", kind: "red", flag: "Unfair shift assignments", points: 2 },
  { questionId: "SERVICE.corporateCulture.5", trigger: "AGREE", kind: "green", flag: "Management backs workers", points: 1 },
  { questionId: "SERVICE.corporateCulture.5", trigger: "DISAGREE", kind: "red", flag: "Toxic floor environment", points: 1 },
  // Leadership & Management
  { questionId: "SERVICE.leadership.1", trigger: "DISAGREE", kind: "red", flag: "Shift favoritism", points: 1 },
  { questionId: "SERVICE.leadership.1", trigger: "AGREE", kind: "green", flag: "Consistent rule enforcement", points: 1 },
  { questionId: "SERVICE.leadership.2", trigger: "AGREE", kind: "green", flag: "Managers help during peaks", points: 2 },
  { questionId: "SERVICE.leadership.3", trigger: "DISAGREE", kind: "red", flag: "Shift favoritism", points: 1 },
  { questionId: "SERVICE.leadership.3", trigger: "AGREE", kind: "green", flag: "Consistent rule enforcement", points: 1 },
  { questionId: "SERVICE.leadership.4", trigger: "DISAGREE", kind: "red", flag: "Ignored operational feedback", points: 1 },
  { questionId: "SERVICE.leadership.5", trigger: "DISAGREE", kind: "red", flag: "Ignored operational feedback", points: 1 },
  // Infrastructure & Resources
  { questionId: "SERVICE.infrastructure.1", trigger: "DISAGREE", kind: "red", flag: "Crashing POS systems", points: 1 },
  { questionId: "SERVICE.infrastructure.1", trigger: "AGREE", kind: "green", flag: "Stocked product inventory", points: 1 },
  { questionId: "SERVICE.infrastructure.2", trigger: "AGREE", kind: "green", flag: "Clean break areas", points: 1 },
  { questionId: "SERVICE.infrastructure.2", trigger: "DISAGREE", kind: "red", flag: "Denied mandatory breaks", points: 1 },
  { questionId: "SERVICE.infrastructure.3", trigger: "DISAGREE", kind: "red", flag: "Crashing POS systems", points: 1 },
  { questionId: "SERVICE.infrastructure.3", trigger: "AGREE", kind: "green", flag: "Stocked product inventory", points: 1 },
  { questionId: "SERVICE.infrastructure.4", trigger: "AGREE", kind: "green", flag: "Clean break areas", points: 1 },
  { questionId: "SERVICE.infrastructure.5", trigger: "DISAGREE", kind: "red", flag: "Denied mandatory breaks", points: 1 },
  // Work-Life Balance
  { questionId: "SERVICE.workLifeBalance.1", trigger: "AGREE", kind: "green", flag: "Advanced schedule posting", points: 1 },
  { questionId: "SERVICE.workLifeBalance.2", trigger: "DISAGREE", kind: "red", flag: "Pressured on days off", points: 1 },
  { questionId: "SERVICE.workLifeBalance.3", trigger: "AGREE", kind: "green", flag: "Advanced schedule posting", points: 1 },
  { questionId: "SERVICE.workLifeBalance.3", trigger: "DISAGREE", kind: "red", flag: "Clopening shifts assigned", points: 2 },
  { questionId: "SERVICE.workLifeBalance.4", trigger: "AGREE", kind: "green", flag: "Respected personal time", points: 1 },
  { questionId: "SERVICE.workLifeBalance.5", trigger: "AGREE", kind: "green", flag: "Respected personal time", points: 1 },
  { questionId: "SERVICE.workLifeBalance.5", trigger: "DISAGREE", kind: "red", flag: "Pressured on days off", points: 1 },
  // Organizational Stability
  { questionId: "SERVICE.stability.1", trigger: "AGREE", kind: "green", flag: "Accurate tip payouts", points: 1 },
  { questionId: "SERVICE.stability.1", trigger: "DISAGREE", kind: "red", flag: "Wage theft", points: 1 },
  { questionId: "SERVICE.stability.2", trigger: "AGREE", kind: "green", flag: "Accurate tip payouts", points: 1 },
  { questionId: "SERVICE.stability.2", trigger: "DISAGREE", kind: "red", flag: "Wage theft", points: 1 },
  { questionId: "SERVICE.stability.3", trigger: "DISAGREE", kind: "red", flag: "Constant understaffing", points: 1 },
  { questionId: "SERVICE.stability.4", trigger: "AGREE", kind: "green", flag: "Clear advancement paths", points: 1 },
  { questionId: "SERVICE.stability.4", trigger: "DISAGREE", kind: "red", flag: "Constant understaffing", points: 1 },
  { questionId: "SERVICE.stability.5", trigger: "DISAGREE", kind: "green", flag: "Clear advancement paths", points: 1 },
];

const MANUAL_LABOUR_RULES: FlagRule[] = [
  // Corporate Culture
  { questionId: "MANUAL_LABOUR.corporateCulture.1", trigger: "AGREE", kind: "green", flag: "Health prioritized", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.2", trigger: "DISAGREE", kind: "red", flag: "Toxic machismo behavior", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.3", trigger: "AGREE", kind: "green", flag: "Labor rights respected", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.3", trigger: "DISAGREE", kind: "red", flag: "Retaliation for injuries", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.4", trigger: "AGREE", kind: "green", flag: "Health prioritized", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.4", trigger: "DISAGREE", kind: "red", flag: "Retaliation for injuries", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.5", trigger: "DISAGREE", kind: "red", flag: "Toxic machismo behavior", points: 1 },
  { questionId: "MANUAL_LABOUR.corporateCulture.5", trigger: "AGREE", kind: "green", flag: "Labor rights respected", points: 1 },
  // Leadership & Management
  { questionId: "MANUAL_LABOUR.leadership.1", trigger: "AGREE", kind: "green", flag: "Hands-on manager experience", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.2", trigger: "DISAGREE", kind: "red", flag: "Unfair danger assignments", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.3", trigger: "AGREE", kind: "green", flag: "Hands-on manager experience", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.3", trigger: "DISAGREE", kind: "red", flag: "Hypocritical safety rules", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.4", trigger: "AGREE", kind: "green", flag: "Fast safety fixes", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.4", trigger: "DISAGREE", kind: "red", flag: "Unfair danger assignments", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.5", trigger: "AGREE", kind: "green", flag: "Fast safety fixes", points: 1 },
  { questionId: "MANUAL_LABOUR.leadership.5", trigger: "DISAGREE", kind: "red", flag: "Hypocritical safety rules", points: 1 },
  // Infrastructure & Resources
  { questionId: "MANUAL_LABOUR.infrastructure.1", trigger: "DISAGREE", kind: "red", flag: "Unsafe heavy machinery", points: 1 },
  { questionId: "MANUAL_LABOUR.infrastructure.2", trigger: "AGREE", kind: "green", flag: "Free required PPE", points: 1 },
  { questionId: "MANUAL_LABOUR.infrastructure.3", trigger: "AGREE", kind: "green", flag: "Clean on-site amenities", points: 1 },
  { questionId: "MANUAL_LABOUR.infrastructure.4", trigger: "AGREE", kind: "green", flag: "Clean on-site amenities", points: 1 },
  { questionId: "MANUAL_LABOUR.infrastructure.4", trigger: "DISAGREE", kind: "red", flag: "Raw material delays", points: 2 },
  { questionId: "MANUAL_LABOUR.infrastructure.5", trigger: "AGREE", kind: "green", flag: "Free required PPE", points: 1 },
  { questionId: "MANUAL_LABOUR.infrastructure.5", trigger: "DISAGREE", kind: "red", flag: "Unsafe heavy machinery", points: 1 },
  // Work-Life Balance
  { questionId: "MANUAL_LABOUR.workLifeBalance.1", trigger: "DISAGREE", kind: "red", flag: "Exhausting shift lengths", points: 1 },
  { questionId: "MANUAL_LABOUR.workLifeBalance.2", trigger: "DISAGREE", kind: "red", flag: "Mandatory overtime threats", points: 2 },
  { questionId: "MANUAL_LABOUR.workLifeBalance.3", trigger: "AGREE", kind: "green", flag: "Enforced hydration breaks", points: 2 },
  { questionId: "MANUAL_LABOUR.workLifeBalance.4", trigger: "AGREE", kind: "green", flag: "Compensated travel time", points: 1 },
  { questionId: "MANUAL_LABOUR.workLifeBalance.5", trigger: "AGREE", kind: "green", flag: "Enforced hydration breaks", points: 1 },
  { questionId: "MANUAL_LABOUR.workLifeBalance.5", trigger: "DISAGREE", kind: "red", flag: "Exhausting shift lengths", points: 1 },
  // Organizational Stability
  { questionId: "MANUAL_LABOUR.stability.1", trigger: "AGREE", kind: "green", flag: "Accurate paychecks", points: 1 },
  { questionId: "MANUAL_LABOUR.stability.2", trigger: "DISAGREE", kind: "red", flag: "Chaotic hire-and-fire", points: 2 },
  { questionId: "MANUAL_LABOUR.stability.2", trigger: "DISAGREE", kind: "red", flag: "Missing liability insurance", points: 1 },
  { questionId: "MANUAL_LABOUR.stability.3", trigger: "AGREE", kind: "green", flag: "Funded safety training", points: 2 },
  { questionId: "MANUAL_LABOUR.stability.4", trigger: "AGREE", kind: "green", flag: "Accurate paychecks", points: 1 },
  { questionId: "MANUAL_LABOUR.stability.4", trigger: "DISAGREE", kind: "red", flag: "Missing liability insurance", points: 1 },
  // stability.5 ("can your body sustain this for 5 years?") carries no flag
  // award in product's spec — score-only, like every question's 0.2-point
  // category deduction, which stays server-side and out of scope here.
];

const RULES_BY_WORKPLACE_TYPE: Record<WorkplaceType, FlagRule[]> = {
  OFFICE: OFFICE_RULES,
  HYBRID_REMOTE: HYBRID_REMOTE_RULES,
  SERVICE: SERVICE_RULES,
  MANUAL_LABOUR: MANUAL_LABOUR_RULES,
};

// A handful of green/red flag pairs are literally opposite readings of the
// exact same pair of questions (e.g. OFFICE's "Uncontacted PTO." and
// "After-hours replies expected." both come from nothing but
// workLifeBalance.1 + .3, on opposite majority sides) — showing both at once
// reads as a contradiction ("this company respects PTO AND expects
// after-hours replies?"). For these specific pairs only, keep whichever side
// actually scored higher and drop the other; an exact tie drops both, since
// neither reading is more true than the other. Every other flag in the
// system draws from its own distinct question(s) and isn't touched by this.
// Derived by grouping every rule above by its (kind, flag) and finding
// green/red pairs whose contributing questionId sets are identical.
const OPPOSITE_FLAG_PAIRS: Partial<Record<WorkplaceType, [green: string, red: string][]>> = {
  OFFICE: [
    ["Leaders take blame.", "Unprotected from workload."],
    ["Uncontacted PTO.", "After-hours replies expected."],
    ["Funded career growth", "High turnover"],
  ],
  HYBRID_REMOTE: [["High-quality hardware stipend", "Chaotic digital tools"]],
  SERVICE: [
    ["Consistent rule enforcement", "Shift favoritism"],
    ["Stocked product inventory", "Crashing POS systems"],
    ["Accurate tip payouts", "Wage theft"],
  ],
};

function sortTriggered(flags: TriggeredFlag[]): TriggeredFlag[] {
  return flags
    .filter((f) => f.points >= MIN_POINTS_TO_DISPLAY)
    .sort((a, b) => b.points - a.points || a.flag.localeCompare(b.flag));
}

/**
 * Reduces one work-type's survey-stats question list down to its triggered
 * green/red flags. Trigger direction is majority vote per question (more
 * agree than disagree, or vice versa — a tie triggers neither side), since
 * the input is a company-wide aggregate across every reviewer, not one
 * person's answers.
 */
export function computeWorkplaceVibeFlags(
  workplaceType: WorkplaceType,
  questions: SurveyQuestionStats[],
): WorkplaceVibeFlags {
  const rules = RULES_BY_WORKPLACE_TYPE[workplaceType] ?? [];
  const statsById = new Map(questions.map((q) => [q.questionId, q]));
  const totals = new Map<string, { kind: FlagKind; flag: string; points: number }>();

  for (const rule of rules) {
    const stats = statsById.get(rule.questionId);
    if (!stats) continue;
    const majority: FlagTrigger | null =
      stats.agreeCount === stats.disagreeCount ? null : stats.agreeCount > stats.disagreeCount ? "AGREE" : "DISAGREE";
    if (majority !== rule.trigger) continue;

    const key = `${rule.kind}:${rule.flag}`;
    const existing = totals.get(key);
    totals.set(key, { kind: rule.kind, flag: rule.flag, points: (existing?.points ?? 0) + rule.points });
  }

  for (const [greenFlag, redFlag] of OPPOSITE_FLAG_PAIRS[workplaceType] ?? []) {
    const g = totals.get(`green:${greenFlag}`);
    const r = totals.get(`red:${redFlag}`);
    if (!g || !r) continue;
    if (g.points === r.points) {
      totals.delete(`green:${greenFlag}`);
      totals.delete(`red:${redFlag}`);
    } else if (g.points > r.points) {
      totals.delete(`red:${redFlag}`);
    } else {
      totals.delete(`green:${greenFlag}`);
    }
  }

  const green: TriggeredFlag[] = [];
  const red: TriggeredFlag[] = [];
  for (const { kind, flag, points } of totals.values()) {
    (kind === "green" ? green : red).push({ flag, points });
  }

  return { green: sortTriggered(green), red: sortTriggered(red) };
}

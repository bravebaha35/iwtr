import { Injectable } from "@nestjs/common";
import type { CategoryKey, CompanyWorkplaceSurveyStats, WorkplaceType } from "@iwtr/shared-types";

export type FlagColor = "GREEN" | "RED";

export interface VibeFlag {
  category: CategoryKey;
  cluster: 1 | 2;
  color: FlagColor;
  label: string;
}

interface QuestionTally {
  questionId: string;
  agreeCount: number;
  disagreeCount: number;
}

interface CategoryFlagPair {
  green1: string;
  green2: string;
  red1: string;
  red2: string;
}

/**
 * The Master Dual-Opposite Flag Chart, transcribed verbatim from the
 * CEO-provided PDF. Deliberately kept as plain data (not derived from
 * survey-questions.data.ts) since the two are independent business
 * artifacts that happen to share a category axis — a future edit to one
 * must not silently reshape the other.
 */
const MASTER_FLAG_CHART: Record<WorkplaceType, Record<CategoryKey, CategoryFlagPair>> = {
  OFFICE: {
    corporateCulture: { green1: "Collaborative Team", green2: "Ethical Leadership", red1: "Toxic Backstabbing", red2: "Hypocritical Leadership" },
    leadership: { green1: "Accountable Managers", green2: "Actionable Feedback", red1: "Blames Subordinates", red2: "Extreme Micromanagement" },
    infrastructure: { green1: "Modern Equipment", green2: "Fast IT Support", red1: "Outdated Tech", red2: "Neglected Maintenance" },
    workLifeBalance: { green1: "Paid Overtime", green2: "Disconnect After Hours", red1: "Unpaid Overtime Expected", red2: "After-Hours Pressure" },
    stability: { green1: "High Job Security", green2: "Predictable Promotions", red1: "High Turnover", red2: "Chaotic Layoffs" },
  },
  HYBRID_REMOTE: {
    corporateCulture: { green1: "Trust Without Tracking", green2: "Timezones Respected", red1: "Surveillance Software", red2: "Ignored Timezones" },
    leadership: { green1: "Outcome-Based Evaluation", green2: "Proactive Burnout Care", red1: "Status Icon Tracking", red2: "Burnout Ignored" },
    infrastructure: { green1: "Hardware Stipend", green2: "Reliable Cloud Access", red1: "Forced Personal Tech", red2: "Unreliable Remote Access" },
    workLifeBalance: { green1: "Enforced Disconnect", green2: "Manageable Workload", red1: "Blurred Unpaid Hours", red2: "Pointless RTO Mandates" },
    stability: { green1: "Equal Remote Pay", green2: "Secure Remote Policy", red1: "Remote Pay Penalties", red2: "Constant RTO Threats" },
  },
  SERVICE: {
    corporateCulture: { green1: "Defends Staff From Customers", green2: "Realistic Speed Targets", red1: "Customer Is Always Right", red2: "Dangerous Service Shortcuts" },
    leadership: { green1: "Hands-On Management", green2: "Impartial Scheduling", red1: "Absent During Peaks", red2: "Supervisor Favoritism" },
    infrastructure: { green1: "Reliable Service Tech", green2: "Sanitary Break Areas", red1: "Crashing POS Systems", red2: "Neglected Break Zones" },
    workLifeBalance: { green1: "Advanced Schedule Notice", green2: "Voluntary Overtime", red1: "Last-Minute Shift Changes", red2: "Forced Clopening Shifts" },
    stability: { green1: "100% Accurate Wages", green2: "Fully Staffed Shifts", red1: "Wage & Tip Theft", red2: "Constant Understaffing" },
  },
  MANUAL_LABOUR: {
    corporateCulture: { green1: "Health & Safety First", green2: "Respectful Site Culture", red1: "Speed Over Safety", red2: "Toxic Machismo & Hazing" },
    leadership: { green1: "Experienced Foremen", green2: "Immediate Hazard Resolution", red1: "Inexperienced Management", red2: "Unsafe Conditions Ignored" },
    infrastructure: { green1: "Safe Heavy Machinery", green2: "Free Required PPE", red1: "Unsafe Equipment", red2: "PPE Not Provided" },
    workLifeBalance: { green1: "Enforced Hydration Breaks", green2: "Safe Shift Durations", red1: "Denied Rest & Water", red2: "Exhausting Shift Lengths" },
    stability: { green1: "Accurate Hazard Pay", green2: "Consistent Year-Round Work", red1: "Missing Hazard Pay", red2: "Chaotic Hire-and-Fire" },
  },
};

const CATEGORY_KEYS: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

// Question ids are "${workplaceType}.${category}.${n}" (survey-questions.data.ts) — n
// is the only part that matters for cluster assignment.
function questionOrdinal(questionId: string): number {
  return Number(questionId.slice(questionId.lastIndexOf(".") + 1));
}

/**
 * Dual-Opposite Flag Aggregation Engine. Pure, DB-free: takes only the
 * already-anonymized per-question agree/disagree counts a company's
 * published reviews produced (see ReviewsService.getSurveyStats) and maps
 * them to the two flags (one per cluster) the chart assigns that category.
 * Never sees, and has no way to see, an individual employee's answers.
 */
@Injectable()
export class FlagCalculatorService {
  /**
   * Splits a category's 5 questions into Cluster 1 (Q1-Q3) and Cluster 2
   * (Q4-Q5). For each cluster, a question counts as "positive" only when
   * strictly more reviewers agreed with the healthy answer than disagreed
   * (a per-question tie counts as not-positive). The cluster's flag is
   * GREEN when a majority of its questions are positive, RED otherwise —
   * including an exact 50/50 split, which only the 2-question Cluster 2 can
   * ever reach (a 3-question cluster can only land on 0%, 33%, 67%, or
   * 100%), per the CEO's worker-safety-first tie-break rule.
   */
  computeCategoryFlags(workplaceType: WorkplaceType, category: CategoryKey, questions: QuestionTally[]): VibeFlag[] {
    const chart = MASTER_FLAG_CHART[workplaceType][category];
    const cluster1 = questions.filter((q) => questionOrdinal(q.questionId) <= 3);
    const cluster2 = questions.filter((q) => questionOrdinal(q.questionId) >= 4);

    const colorFor = (cluster: QuestionTally[]): FlagColor => {
      const positiveCount = cluster.filter((q) => q.agreeCount > q.disagreeCount).length;
      return positiveCount / cluster.length > 0.5 ? "GREEN" : "RED";
    };

    const color1 = colorFor(cluster1);
    const color2 = colorFor(cluster2);

    return [
      { category, cluster: 1, color: color1, label: color1 === "GREEN" ? chart.green1 : chart.red1 },
      { category, cluster: 2, color: color2, label: color2 === "GREEN" ? chart.green2 : chart.red2 },
    ];
  }

  /**
   * Company-facing entry point: fans computeCategoryFlags out across all 5
   * categories for one workplaceType section of GET .../survey-stats. A
   * company with no published reviews yet for this type has nothing to say,
   * so it gets no flags rather than 10 default-RED ones.
   */
  computeVibeFlags(stats: CompanyWorkplaceSurveyStats): VibeFlag[] {
    if (stats.totalReviews === 0) return [];
    return CATEGORY_KEYS.flatMap((category) =>
      this.computeCategoryFlags(
        stats.workplaceType,
        category,
        stats.questions.filter((q) => q.category === category),
      ),
    );
  }
}

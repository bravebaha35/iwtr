import type { SurveyAnswer, WorkplaceType } from "@iwtr/shared-types";

export interface YellowFlagPairDefinition {
  id: string;
  label: string;
  // Plain-English "why" shown on hover/focus of the ❓ in the UI — spells
  // out the specific contradiction this pair flags, in terms of the two
  // underlying questions rather than just repeating the label.
  explanation: string;
  questionAId: string;
  answerA: SurveyAnswer;
  questionBId: string;
  answerB: SurveyAnswer;
}

/**
 * Yellow Flag ("mixed signals") pair definitions, transcribed from the
 * CEO-provided contradiction spec. Each pair names two of a workplaceType's
 * 25 survey questions (ids per survey-questions.data.ts's
 * "${workplaceType}.${category}.${n}" scheme) plus the exact answer
 * combination that exposes a contradiction. Deliberately cross-category
 * (e.g. a corporateCulture question paired against a leadership question) —
 * unlike MASTER_FLAG_CHART's within-category clusters in
 * flag-calculator.service.ts, a "mixed signal" is inherently about two
 * different axes of the same workplace disagreeing with each other, so it
 * doesn't fit that chart's category/cluster shape and is kept as its own
 * flat per-workplaceType list instead.
 */
export const YELLOW_FLAG_PAIRS: Record<WorkplaceType, YellowFlagPairDefinition[]> = {
  OFFICE: [
    {
      id: "office-toxic-positivity",
      label: "Toxic Positivity",
      explanation:
        "Reviewers say management actually practices the values it preaches publicly — but also say they've personally witnessed office politics or favoritism decide promotions over merit.",
      questionAId: "OFFICE.corporateCulture.4",
      answerA: "YES",
      questionBId: "OFFICE.corporateCulture.2",
      answerB: "YES",
    },
    {
      id: "office-high-autonomy-abandoned",
      label: "High Autonomy / Abandoned",
      explanation:
        "Reviewers say middle management doesn't micromanage daily tasks — but also say their manager doesn't protect them from unreasonable workload spikes from executives.",
      questionAId: "OFFICE.leadership.1",
      answerA: "NO",
      questionBId: "OFFICE.leadership.5",
      answerB: "NO",
    },
    {
      id: "office-flexible-but-tracked",
      label: `"Flexible" but Tracked`,
      explanation:
        "Reviewers say management allows flexibility for personal or medical appointments — but also say management tracks seat time or online status icons over actual deliverables.",
      questionAId: "OFFICE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "OFFICE.workLifeBalance.5",
      answerB: "YES",
    },
  ],
  HYBRID_REMOTE: [
    {
      id: "hybrid-trust-on-paper",
      label: "Trust on Paper / Tracked in Practice",
      explanation:
        "Reviewers say management trusts remote employees without tracking or surveillance software — but also say they can't step away from their computer during the day without feeling anxious about their status icon.",
      questionAId: "HYBRID_REMOTE.corporateCulture.1",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.workLifeBalance.2",
      answerB: "NO",
    },
    {
      id: "hybrid-flexible-hours-always-on",
      label: `"Flexible" Hours / Always On`,
      explanation:
        "Reviewers say their workload is realistically manageable within a standard work week — but also say the lines between personal life and the workday frequently blur into unpaid hours.",
      questionAId: "HYBRID_REMOTE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.workLifeBalance.1",
      answerB: "YES",
    },
    {
      id: "hybrid-optional-fun",
      label: `"Optional" Fun`,
      explanation:
        "Reviewers say the company respects asynchronous communication, with time to reply without pressure — but also say remote socialization carries social penalties for not attending.",
      questionAId: "HYBRID_REMOTE.corporateCulture.3",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.corporateCulture.5",
      answerB: "NO",
    },
  ],
  SERVICE: [
    {
      id: "service-family-vibe",
      label: `The "We're a Family" Vibe`,
      explanation:
        "Reviewers say the floor is supportive rather than competitive or toxic — but also say shift supervisors play favorites when scheduling shifts or assigning tasks.",
      questionAId: "SERVICE.corporateCulture.2",
      answerA: "YES",
      questionBId: "SERVICE.leadership.1",
      answerB: "YES",
    },
    {
      id: "service-flexible-shifts",
      label: `"Flexible" Shifts`,
      explanation:
        "Reviewers say overtime is strictly voluntary rather than forced on short notice — but also say schedules aren't posted at least two weeks in advance.",
      questionAId: "SERVICE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "SERVICE.workLifeBalance.1",
      answerB: "NO",
    },
    {
      id: "service-team-players-management-watches",
      label: `"Team Players" (But Management Watches)`,
      explanation:
        "Reviewers say management takes the worker's side against abusive or aggressive customers — but also say managers don't step onto the floor to help during peak busy hours.",
      questionAId: "SERVICE.corporateCulture.1",
      answerA: "YES",
      questionBId: "SERVICE.leadership.2",
      answerB: "NO",
    },
  ],
  MANUAL_LABOUR: [
    {
      id: "manual-safety-first-illusion",
      label: `"Safety First" Illusion`,
      explanation:
        "Reviewers say physical health and safety is genuinely prioritized over production speed — but also say managers don't follow the exact same safety rules they enforce on the crew.",
      questionAId: "MANUAL_LABOUR.corporateCulture.1",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.leadership.3",
      answerB: "NO",
    },
    {
      id: "manual-fast-paced-environment",
      label: `"Fast-Paced" Environment`,
      explanation:
        "Reviewers say mandatory hydration and rest breaks are strictly enforced — but also say the work pace doesn't allow their body sufficient recovery time between shifts.",
      questionAId: "MANUAL_LABOUR.workLifeBalance.3",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.workLifeBalance.5",
      answerB: "NO",
    },
    {
      id: "manual-brotherhood-crew-divide",
      label: "Brotherhood / Crew Divide",
      explanation:
        "Reviewers say the crew works as a supportive unit rather than being pitted against each other with metrics — but also say injured workers aren't treated fairly or supported without fear of retaliation.",
      questionAId: "MANUAL_LABOUR.corporateCulture.5",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.corporateCulture.4",
      answerB: "NO",
    },
  ],
};

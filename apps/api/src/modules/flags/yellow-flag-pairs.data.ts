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
 * Yellow Flag ("mixed signals") pair definitions, rewritten 2026-10-24 for
 * survey question set v2 (the first four per work type keep the ideas of the
 * CEO-provided contradiction spec, re-pointed at the revised questions). The
 * Turkish label and explanation are in apps/web (lib/i18n/tr/flags.ts), keyed
 * by the English text. Each pair names two of a workplaceType's
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
      id: "office-values-vs-politics",
      label: "Values on the wall, politics in practice",
      explanation:
        "Reviewers say management practises the values it preaches, but also say office politics or favouritism decide promotions.",
      questionAId: "OFFICE.corporateCulture.4",
      answerA: "YES",
      questionBId: "OFFICE.corporateCulture.2",
      answerB: "YES",
    },
    {
      id: "office-hands-off-unprotected",
      label: "Hands-off, but unprotected",
      explanation:
        "Reviewers say managers do not micromanage, but also say their manager does not shield them from sudden workload spikes from above.",
      questionAId: "OFFICE.leadership.1",
      answerA: "NO",
      questionBId: "OFFICE.leadership.5",
      answerB: "NO",
    },
    {
      id: "office-flexible-but-tracked",
      label: "Flexible, but watched",
      explanation:
        "Reviewers say they get flexibility for personal or medical appointments, but also say management watches seat time or online status more than results.",
      questionAId: "OFFICE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "OFFICE.workLifeBalance.5",
      answerB: "YES",
    },
    {
      id: "office-heard-not-told",
      label: "Heard, but not told",
      explanation:
        "Reviewers say they can criticise decisions openly, but also say major decisions are not explained before they take effect.",
      questionAId: "OFFICE.corporateCulture.3",
      answerA: "YES",
      questionBId: "OFFICE.leadership.4",
      answerB: "NO",
    },
  ],
  HYBRID_REMOTE: [
    {
      id: "hybrid-trust-on-paper",
      label: "Trusted on paper, watched in practice",
      explanation:
        "Reviewers say management trusts remote staff without tracking software, but also say they cannot step away from the computer without worrying about their status icon.",
      questionAId: "HYBRID_REMOTE.corporateCulture.1",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.workLifeBalance.2",
      answerB: "NO",
    },
    {
      id: "hybrid-manageable-but-always-on",
      label: "Manageable workload, blurred hours",
      explanation:
        "Reviewers say the workload fits a normal week, but also say work regularly spills into unpaid personal time.",
      questionAId: "HYBRID_REMOTE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.workLifeBalance.1",
      answerB: "YES",
    },
    {
      id: "hybrid-optional-fun",
      label: "\"Optional\" socials",
      explanation:
        "Reviewers say the company respects their time to reply, but also say skipping remote social events comes with social penalties.",
      questionAId: "HYBRID_REMOTE.corporateCulture.3",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.corporateCulture.5",
      answerB: "NO",
    },
    {
      id: "hybrid-equal-pay-unequal-path",
      label: "Equal pay, unequal path",
      explanation:
        "Reviewers say remote staff are paid the same as office staff, but also say remote staff get less mentoring and fewer chances to move up.",
      questionAId: "HYBRID_REMOTE.stability.2",
      answerA: "YES",
      questionBId: "HYBRID_REMOTE.stability.3",
      answerB: "NO",
    },
  ],
  SERVICE: [
    {
      id: "service-family-vibe",
      label: "\"We are a family\", with favourites",
      explanation:
        "Reviewers say the floor is supportive, but also say supervisors play favourites with shifts and tasks.",
      questionAId: "SERVICE.corporateCulture.2",
      answerA: "YES",
      questionBId: "SERVICE.leadership.1",
      answerB: "YES",
    },
    {
      id: "service-voluntary-but-unplanned",
      label: "Voluntary overtime, unplanned schedules",
      explanation:
        "Reviewers say overtime is voluntary, but also say schedules are not posted two weeks ahead.",
      questionAId: "SERVICE.workLifeBalance.4",
      answerA: "YES",
      questionBId: "SERVICE.workLifeBalance.1",
      answerB: "NO",
    },
    {
      id: "service-backed-up-alone-at-peaks",
      label: "Backed up, but alone at rush hour",
      explanation:
        "Reviewers say management takes their side against abusive customers, but also say managers do not help on the floor at peak times.",
      questionAId: "SERVICE.corporateCulture.1",
      answerA: "YES",
      questionBId: "SERVICE.leadership.2",
      answerB: "NO",
    },
    {
      id: "service-paid-not-explained",
      label: "Paid, but not explained",
      explanation:
        "Reviewers say tips and bonuses arrive accurately, but also say it is not made clear how pay, overtime and tips are calculated.",
      questionAId: "SERVICE.stability.2",
      answerA: "YES",
      questionBId: "SERVICE.stability.1",
      answerB: "NO",
    },
  ],
  MANUAL_LABOUR: [
    {
      id: "manual-safety-first-illusion",
      label: "\"Safety first\" on paper",
      explanation:
        "Reviewers say safety comes before speed, but also say managers do not follow the safety rules they enforce on the crew.",
      questionAId: "MANUAL_LABOUR.corporateCulture.1",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.leadership.3",
      answerB: "NO",
    },
    {
      id: "manual-breaks-but-no-recovery",
      label: "Breaks on the clock, no real recovery",
      explanation:
        "Reviewers say rest and water breaks are kept, but also say there is not enough recovery time between shifts.",
      questionAId: "MANUAL_LABOUR.workLifeBalance.3",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.workLifeBalance.5",
      answerB: "NO",
    },
    {
      id: "manual-crew-divide",
      label: "A close crew, a cold response to injuries",
      explanation:
        "Reviewers say the crew supports each other, but also say injured workers are not treated fairly or fear losing their job.",
      questionAId: "MANUAL_LABOUR.corporateCulture.5",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.corporateCulture.4",
      answerB: "NO",
    },
    {
      id: "manual-ppe-but-unsafe-machines",
      label: "Protective gear, unsafe machines",
      explanation:
        "Reviewers say protective equipment is provided free, but also say machines and tools are not kept safe to use.",
      questionAId: "MANUAL_LABOUR.infrastructure.2",
      answerA: "YES",
      questionBId: "MANUAL_LABOUR.infrastructure.1",
      answerB: "NO",
    },
  ],
};

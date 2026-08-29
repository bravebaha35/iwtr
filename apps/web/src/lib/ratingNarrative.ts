import type { WorkplaceType } from "@iwtr/shared-types";

// Pure score/work-type -> {image, text} mapping for the company page's
// "Dynamic Rating Visuals" box. Deliberately its own small tier scheme (not
// scoreBandLabel/scoreBands from shared-types) even though the numeric
// boundaries are the same 0/2.0/3.0/4.0/5.0 cut points that file already
// uses — the label text here is a longer, prescriptive paragraph unique to
// this box, not the short badge word shown next to the score elsewhere, so
// reusing that type would just be a same-shape coincidence, not a shared
// concept worth coupling to.
type ScoreTier = "unsatisfactory" | "developing" | "effective" | "highlyEffective" | "exemplary";

const WORKPLACE_IMAGE_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "hybrid",
  SERVICE: "service",
  MANUAL_LABOUR: "manuallabour",
};

// Per-work-type copy (user-supplied verbatim) — unlike the old single
// flat TIER_TEXT, "Office" staff and "Manual-Labour" crew at the same
// numeric score read entirely different paragraphs, since what "1 star"
// actually looks like on the ground differs by the kind of work.
const WORKPLACE_TIER_TEXT: Record<WorkplaceType, Record<ScoreTier, string>> = {
  OFFICE: {
    unsatisfactory:
      "This office is plagued by toxic politics, mandatory uncompensated overtime, and management that values seat-time over actual output. High turnover, neglected equipment, and rampant micromanagement make this a highly stressful environment for employees.",
    developing:
      "While there are some attempts at balance, employees still struggle with outdated hardware and occasional pressure to reply to messages after hours. Leadership communication is inconsistent, and workers may face unpredictable workload spikes without manager protection.",
    effective:
      "The company provides a generally quiet workspace, functional IT support, and managers who offer constructive feedback rather than placing blame for failures. Employees can take their approved PTO without being bothered, and salary reviews follow a fairly predictable schedule.",
    highlyEffective:
      "Leadership actively practices their stated values, encourages open criticism without retaliation, and ensures the office infrastructure supports deep focus. Employees enjoy genuine flexibility for personal appointments and feel confident in the company's funded career growth paths.",
    exemplary:
      "This workplace offers an exceptionally healthy culture where promotions are strictly merit-based and credit-stealing is virtually non-existent. Managers fiercely protect their teams from unreasonable executive workloads while providing top-tier resources, ensuring absolute job stability and a perfect work-life balance.",
  },
  HYBRID_REMOTE: {
    unsatisfactory:
      "Remote workers face severe disadvantages here, enduring digital surveillance, constant return-to-office threats, and obvious favoritism toward in-office staff. Unresponsive managers and chaotic digital tools lead to heavily blurred lines between personal time and unpaid working hours.",
    developing:
      "The company offers remote work but struggles with maintaining clear documentation and running structured virtual meetings. Employees might feel pressured to attend optional social events and often worry about sudden offshoring or job elimination.",
    effective:
      "Management generally evaluates performance based on outcomes rather than online activity dots, and basic cloud tools are adequately reliable. Time zones are mostly respected for scheduling, and employees receive equal pay regardless of their physical working location.",
    highlyEffective:
      "The company provides excellent hardware stipends and actively respects asynchronous communication, allowing workers to confidently disconnect after their shift. Leadership proactively steps in to prevent burnout and ensures remote staff have equal access to mentorship and career advancement.",
    exemplary:
      "This remote environment operates on absolute trust without surveillance, featuring flawless digital collaboration tools and complete financial transparency from leadership. Hybrid workers are never forced into pointless mandatory in-office days, ensuring workloads remain highly manageable within a strictly protected standard week.",
  },
  SERVICE: {
    unsatisfactory:
      "Floor staff endure toxic environments characterized by crashing POS systems, unfair shift scheduling, and rampant wage theft. Management prioritizes dangerous speed targets over employee well-being and frequently assigns exhausting clopening shifts or forced overtime.",
    developing:
      "Break areas are occasionally neglected, and workers might struggle with inconsistent product inventory during busy periods. While overt harassment is addressed, supervisors may still show slight favoritism, and understaffing remains a frequent operational issue.",
    effective:
      "Management consistently grants mandatory rest breaks and ensures physical safety protocols are reliably maintained on site. Schedules are posted comfortably in advance, and tips or bonuses are paid out transparently and accurately.",
    highlyEffective:
      "Shift supervisors actively step onto the floor to help during peak hours and enforce company policies fairly across all employees without double standards. The floor environment is highly supportive, and operational feedback from front-line workers is genuinely listened to and implemented.",
    exemplary:
      "Management aggressively defends workers against abusive customers and guarantees clear, realistic paths for floor staff to advance into supervisor roles. Workers are perfectly shielded from off-day coverage pressure, enjoying pristine break areas and total confidence in the business's long-term financial stability.",
  },
  MANUAL_LABOUR: {
    unsatisfactory:
      "This site forces grueling work under toxic machismo conditions, routinely ignoring labor rights and utilizing wildly unsafe heavy machinery. Workers face severe retaliation for reporting injuries, endure chaotic hire-and-fire cycles, and are threatened with termination for declining mandatory overtime.",
    developing:
      "While some safety gear is provided, workers occasionally suffer from delayed raw materials that encourage dangerous workarounds. Shift lengths can sometimes push workers to physical exhaustion, and site amenities like clean water or toilets are inconsistently maintained.",
    effective:
      "The employer supplies all required personal protective equipment free of charge and enforces clear, realistic daily safety briefings. Paychecks are consistently accurate, and mandatory hydration and rest breaks are strictly enforced throughout every single shift.",
    highlyEffective:
      "Site foremen possess extensive hands-on experience and strictly follow the exact same safety rules they enforce on the crew. Dangerous assignments are distributed fairly among the team, and any reported hazards or broken gear are fixed immediately.",
    exemplary:
      "Physical health is elevated completely above production deadlines, ensuring workers can safely sustain their careers for years without bodily ruin. The company fully funds trade training, heavily compensates travel time, and maintains rock-solid workers' compensation, fostering a deeply supportive crew environment.",
  },
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

export interface RatingNarrative {
  // null only for the exemplary (perfect 5.0) tier — no artwork exists for
  // it yet, a placeholder is shown in its place until one is added.
  imageSrc: string | null;
  text: string;
}

export function ratingNarrative(score: number, workplaceType: WorkplaceType): RatingNarrative {
  const tier = scoreTier(score);
  const text = WORKPLACE_TIER_TEXT[workplaceType][tier];
  if (tier === "exemplary") return { imageSrc: null, text };

  const prefix = WORKPLACE_IMAGE_PREFIX[workplaceType];
  const imageSrc = `/${prefix}${TIER_IMAGE_NUMBER[tier]}.png`;
  return { imageSrc, text };
}

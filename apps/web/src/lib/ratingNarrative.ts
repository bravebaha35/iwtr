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

const TIER_TEXT: Record<ScoreTier, string> = {
  unsatisfactory:
    "This rating means the company consistently fails to provide a safe, respectful, or fair working environment. You should avoid applying here unless absolutely necessary, as scores in this range immediately trigger severe red flags for toxic culture or missing amenities.",
  developing:
    "Workplaces with this score have significant, noticeable problems that will likely cause frustration or burnout over time. While some basic conditions are met, you will regularly face issues like poor management, neglected equipment, or unfair shift assignments.",
  effective:
    "This is an average, neutral workplace that meets basic legal requirements and provides standard industry conditions. You will not find exceptional perks or outstanding culture, but it is a stable option if you need immediate employment without extreme warnings.",
  highlyEffective:
    "This company actively prioritizes its employees by maintaining a healthy work-life balance and providing strong, positive support systems. It is a highly recommended place to work where employee reviews generate green flags for fair treatment and reliable infrastructure.",
  exemplary:
    "This rating represents the absolute gold standard in employee treatment, offering exceptional culture, total transparency, and top-tier benefits. Securing a job here means you will be actively protected, valued, and given a platform where workplace problems are actually addressed.",
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
  const text = TIER_TEXT[tier];
  if (tier === "exemplary") return { imageSrc: null, text };

  const prefix = WORKPLACE_IMAGE_PREFIX[workplaceType];
  const imageSrc = `/${prefix}${TIER_IMAGE_NUMBER[tier]}.png`;
  return { imageSrc, text };
}

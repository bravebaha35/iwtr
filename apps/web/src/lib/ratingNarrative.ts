import type { WorkplaceType } from "@iwtr/shared-types";

// Illustration picker for the company page's rating-narrative box. The
// descriptive text itself is now produced server-side
// (GET /companies/:slug/narrative — apps/api/src/modules/company-narrative);
// this file is only the deterministic score -> image mapping.
//
// Assets: apps/web/public/{office,hybrid,service,manuallabour}{1,2,3,4}.png.
// There is no 5th image — "Highly Effective" (4.0-4.5) and "Exemplary"
// (4.5-5.0) both use image 4.
const WORKPLACE_IMAGE_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "hybrid",
  SERVICE: "service",
  MANUAL_LABOUR: "manuallabour",
};

function imageNumber(score: number): 1 | 2 | 3 | 4 {
  if (score >= 4.0) return 4;
  if (score >= 3.0) return 3;
  if (score >= 2.0) return 2;
  return 1;
}

export function ratingImageSrc(score: number, workplaceType: WorkplaceType): string {
  return `/${WORKPLACE_IMAGE_PREFIX[workplaceType]}${imageNumber(score)}.png`;
}

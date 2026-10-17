"use client";

import Image from "next/image";
import { ratingImageSrc } from "@/lib/ratingNarrative";
import { useWorkTypeView, WorkTypeSlide, WorkTypeSwitcher } from "./WorkTypeView";

/**
 * The beaver illustration on the Ratings tab, drawn for the work type on
 * show: a company with an office and a shop floor turns between the two
 * with the switcher at its top-left (or a sideways swipe). The picture's
 * mood still follows the company's overall score.
 */
export function RatingIllustration({ score }: { score: number | null }) {
  const { types, active } = useWorkTypeView();

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
      {types.length > 1 && <WorkTypeSwitcher />}
      <WorkTypeSlide className="h-72 w-56">
        {score !== null ? (
          // A small fixed set of local /public illustrations, not a
          // remote/arbitrary URL.
          <Image src={ratingImageSrc(score, active)} alt="" width={448} height={576} sizes="224px" priority className="h-72 w-56 object-contain" />
        ) : (
          <div className="h-72 w-56" aria-hidden="true" />
        )}
      </WorkTypeSlide>
    </div>
  );
}

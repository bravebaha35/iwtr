"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useT } from "@/lib/i18n/client";

const SWIPE_THRESHOLD_PX = 40;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * A post's photos as one strip that slides sideways, Instagram style:
 * see-through round arrows on either side (only where there is a photo to
 * go to), dots under the photo, swipe on touch screens.
 *
 * "card": the feed card. The first photo's proportions set the height (no
 * taller than 4:5), the others fill that frame.
 * "stage": the photo view. Every photo is shown whole inside the space given.
 *
 * Photos are fetched one ahead of the one on screen, and only once someone
 * is on the strip, so a 10-photo post in the feed costs one photo until then.
 */
export function PhotoSlider({
  imageUrls,
  alt,
  index,
  onIndexChange,
  variant,
  aspectRatio,
  priority = false,
  onPhotoClick,
}: {
  imageUrls: string[];
  alt: string;
  index: number;
  onIndexChange: (next: number) => void;
  variant: "card" | "stage";
  // Width / height of the frame, card variant only.
  aspectRatio?: number;
  priority?: boolean;
  onPhotoClick?: () => void;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  // The furthest photo fetched so far stays fetched, so sliding back never blinks.
  const [reached, setReached] = useState(index);
  // The next photo is fetched once the pointer or a finger is on the strip
  // (or always, in the photo view), not for every card scrolled past.
  const [primed, setPrimed] = useState(variant === "stage");
  // Kept in step when the parent moves the index (arrow keys in the photo view).
  if (index > reached) setReached(index);
  const many = imageUrls.length > 1;
  const furthest = Math.max(reached, primed ? index + 1 : index);

  function go(next: number) {
    onIndexChange(Math.min(imageUrls.length - 1, Math.max(0, next)));
  }

  const arrow =
    "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/75 text-neutral-900 shadow-sm backdrop-blur-sm transition hover:bg-white/95 active:scale-95";

  return (
    <div
      className={`relative overflow-hidden ${variant === "stage" ? "h-full w-full" : "w-full bg-surface-muted"}`}
      style={variant === "card" && aspectRatio ? { aspectRatio } : undefined}
      onPointerEnter={() => setPrimed(true)}
      onFocus={() => setPrimed(true)}
      onTouchStart={(e) => {
        setPrimed(true);
        setTouchStartX(e.touches[0].clientX);
      }}
      onTouchEnd={(e) => {
        if (touchStartX === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) go(index + (delta < 0 ? 1 : -1));
        setTouchStartX(null);
      }}
    >
      <div
        className={`flex h-full ${reduceMotion ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {imageUrls.map((url, i) => (
          <div key={url + i} className="relative h-full w-full shrink-0" aria-hidden={i !== index}>
            {i <= furthest ? (
              // eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads
              <img
                src={url}
                alt={i === index ? alt : ""}
                loading={priority || i > 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                onClick={onPhotoClick}
                className={`block h-full w-full select-none ${variant === "stage" ? "object-contain" : "object-cover"} ${
                  onPhotoClick ? "cursor-zoom-in" : ""
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>

      {many && index > 0 && (
        <button type="button" onClick={() => go(index - 1)} aria-label={t("Previous photo")} className={`${arrow} left-3`}>
          <Chevron direction="left" />
        </button>
      )}
      {many && index < imageUrls.length - 1 && (
        <button type="button" onClick={() => go(index + 1)} aria-label={t("Next photo")} className={`${arrow} right-3`}>
          <Chevron direction="right" />
        </button>
      )}

      {many && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5" aria-hidden="true">
          {imageUrls.map((url, i) => (
            <span
              key={url + i}
              className={`h-1.5 w-1.5 rounded-full shadow-sm transition ${i === index ? "bg-white" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
      {many && (
        <span className="sr-only" aria-live="polite">
          {t("Photo {n} of {total}", { n: index + 1, total: imageUrls.length })}
        </span>
      )}
    </div>
  );
}

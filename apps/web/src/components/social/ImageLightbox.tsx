"use client";

import { useEffect } from "react";

function ChevronIcon({ className, direction }: { className?: string; direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

// Full-screen enlarged view of one post's photo(s) - opened by clicking a
// photo in PostImageCarousel. Arrow-Right/Arrow-Left step through the same
// carousel this post already has (single level, no cross-post navigation);
// Escape or clicking the backdrop closes it.
export function ImageLightbox({
  imageUrls,
  index,
  alt,
  onIndexChange,
  onClose,
}: {
  imageUrls: string[];
  index: number;
  alt: string;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const many = imageUrls.length > 1;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange(Math.min(imageUrls.length - 1, index + 1));
      else if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, imageUrls.length, onIndexChange, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged photo"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      {many && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 text-sm font-medium text-white/80">
          {index + 1} / {imageUrls.length}
        </p>
      )}

      {many && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:left-4"
        >
          <ChevronIcon className="h-6 w-6" direction="left" />
        </button>
      )}
      {many && index < imageUrls.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:right-4"
        >
          <ChevronIcon className="h-6 w-6" direction="right" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img
        src={imageUrls[index]}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

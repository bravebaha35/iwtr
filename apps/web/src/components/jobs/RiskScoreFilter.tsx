"use client";

import { useEffect, useRef } from "react";
import { RewindButton } from "@/components/RewindButton";
import { riskScoreColorClass, RISK_SCORE_NOTES, RiskTriangleIcon } from "@/components/jobs/RiskScoreBadge";

/**
 * The sidebar "Risk Score" slider (0-3, 3 = "Any"), shared by the rating
 * homepage (WorkplaceBrowser) and the Jobs page (JobsBrowser). Click, drag
 * or scroll along the track to pick the highest Risk Score to show.
 */
export function RiskScoreFilter({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  // The wheel listener is attached once; it reads the latest value from here.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // React registers wheel listeners as passive, so preventDefault only works
  // on a native listener - otherwise the page scrolls instead.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onChange(Math.min(3, Math.max(0, valueRef.current + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onChange]);

  function applyFromClientX(el: HTMLDivElement, clientX: number) {
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(Math.round(fraction * 3));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    applyFromClientX(e.currentTarget, e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    applyFromClientX(e.currentTarget, e.clientX);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Score</h2>
        <RewindButton onClick={() => onChange(3)} active={value !== 3} title="Reset Risk Score filter" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg px-3 py-3 select-none">
        <div className="relative pt-8">
          {[0, 1, 2, 3].map((tickValue) => {
            const active = value === tickValue;
            // Grows from 14px (tick 0) to 26px (tick 3) — "exclamation
            // mark gets bigger and bigger until 3" per the design.
            const sizePx = 14 + tickValue * 4;
            return (
              <span
                key={tickValue}
                className={`absolute top-0 flex items-center justify-center transition-all duration-200 ${
                  active ? "scale-110 opacity-100" : "scale-90 opacity-40 grayscale"
                } ${riskScoreColorClass(tickValue)}`}
                style={{ left: `${(tickValue / 3) * 100}%`, width: sizePx, height: sizePx, transform: "translateX(-50%)" }}
              >
                <RiskTriangleIcon className="h-full w-full" />
              </span>
            );
          })}

          <div
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="relative h-2 w-full cursor-pointer touch-none rounded-full"
            style={{ background: "linear-gradient(to right, #22c55e, #f97316, #ef4444)" }}
            title="Click and drag along the slider, or scroll, to choose a maximum Risk Score"
          >
            {[0, 1, 2, 3].map((tickValue) => (
              <span
                key={tickValue}
                className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/70"
                style={{ left: `${(tickValue / 3) * 100}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-foreground shadow-sm"
              style={{ left: `${(value / 3) * 100}%` }}
            />
          </div>
        </div>

        <span className="text-center text-xs font-normal text-muted-foreground">
          {value === 3 ? "Any" : `${value} and Below`}
        </span>
        <p className="text-xs text-muted-foreground">{RISK_SCORE_NOTES[value]}</p>
      </div>
    </div>
  );
}

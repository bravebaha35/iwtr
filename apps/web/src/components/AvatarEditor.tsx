"use client";

import { useRef, useState } from "react";
import type { WorkplaceType } from "@iwtr/shared-types";
import { WORK_TYPE_AVATARS, avatarWorkType } from "@/lib/avatars";
import { AVATAR_GRADIENTS, avatarGradientCss, customGradientColor, customGradientKey } from "@/lib/avatarGradients";
import { WORKPLACE_TYPES, workplaceTypeLabel } from "@/lib/workplaceTypes";

/**
 * "What kind of work?" -> "Choose your avatar" (4 variants of that work
 * type) -> "Background" (12 gradients + a native color-picker popup for any
 * exact color). Shared between onboarding's AvatarPicker and the /me page's
 * profile editor — one place to change the flow for both.
 */
export function AvatarEditor({
  avatarKey,
  avatarGradient,
  onChangeAvatarKey,
  onChangeGradient,
}: {
  avatarKey: string | null;
  avatarGradient: string | null;
  onChangeAvatarKey: (key: string) => void;
  onChangeGradient: (key: string) => void;
}) {
  const [browsingWorkType, setBrowsingWorkType] = useState<WorkplaceType | null>(avatarWorkType(avatarKey));
  const colorInputRef = useRef<HTMLInputElement>(null);

  const variants = WORK_TYPE_AVATARS.find((g) => g.workType === browsingWorkType)?.variants ?? [];
  const customColor = customGradientColor(avatarGradient);

  function pickWorkType(type: WorkplaceType) {
    setBrowsingWorkType(type);
    // A variant from a different work type no longer applies once the type
    // changes — the caller keeps whatever avatarKey it had until a new one
    // is actually picked below, so this alone doesn't clear the selection.
  }

  return (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What kind of work?</p>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {WORKPLACE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => pickWorkType(t.value)}
            className={`rounded-lg p-2 text-[10px] font-medium transition ${
              browsingWorkType === t.value
                ? "bg-brand-100 ring-2 ring-brand-600 dark:bg-brand-900/60"
                : "text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {browsingWorkType && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose your avatar
          </p>
          <div className="mb-6 grid grid-cols-4 gap-3">
            {variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => onChangeAvatarKey(v.key)}
                title={workplaceTypeLabel(browsingWorkType)}
                className={`flex aspect-square items-center justify-center rounded-full text-3xl transition ${
                  avatarKey === v.key
                    ? "ring-3 ring-brand-600 ring-offset-2 ring-offset-surface"
                    : "bg-surface-muted hover:brightness-95 dark:hover:brightness-110"
                }`}
              >
                {v.emoji}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background</p>
      <div className="mb-2 grid grid-cols-6 gap-2">
        {AVATAR_GRADIENTS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => onChangeGradient(g.key)}
            aria-label={g.key}
            className={`aspect-square rounded-full transition ${
              avatarGradient === g.key ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ background: avatarGradientCss(g.key) }}
          />
        ))}
        {/* Shares the last grid cell rather than getting its own row, but
            sized the same as the 11 preset swatches — clicking it triggers
            the hidden native color input, which opens the browser/OS's own
            color-picker popup. */}
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          aria-label="Pick a custom color"
          title="Pick a custom color"
          className={`relative aspect-square rounded-full transition ${
            customColor ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface" : ""
          }`}
          style={{ background: customColor ?? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={customColor ?? "#888888"}
            onChange={(e) => onChangeGradient(customGradientKey(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-hidden="true"
            tabIndex={-1}
          />
        </button>
      </div>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { WorkplaceType } from "@iwtr/shared-types";
import {
  AVATAR_WORK_TYPES,
  avatarChoices,
  avatarGender,
  avatarImageUrl,
  avatarKeyForGender,
  avatarWorkType,
  type AvatarGender,
} from "@/lib/avatars";
import { AVATAR_GRADIENTS, avatarGradientCss, customGradientColor, customGradientKey } from "@/lib/avatarGradients";
import { collarTileTone } from "@/lib/collarColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { useT } from "@/lib/i18n/client";

/**
 * "Choose your avatar" (a gender, one of the four work types via the dots,
 * then one of 4 beavers) -> "Background" (11 gradients + a native
 * color-picker popup for any exact color). Shared between onboarding's
 * AvatarPicker and the /me page's Customize tab.
 *
 * The gender toggle sits beside the "Choose your avatar" heading unless the
 * caller renders its own (Customize puts it next to the name and passes
 * gender + onChangeGender). Switching gender swaps the picked beaver for the
 * same one of the other gender, so the avatar changes straight away.
 */
export function AvatarEditor({
  avatarKey,
  avatarGradient,
  onChangeAvatarKey,
  onChangeGradient,
  workType,
  gender: controlledGender,
  onChangeGender,
}: {
  avatarKey: string | null;
  avatarGradient: string | null;
  onChangeAvatarKey: (key: string) => void;
  onChangeGradient: (key: string) => void;
  // The work-type dot to start on when the current avatar doesn't say
  // (no avatar yet): the member's own work type, if known.
  workType?: WorkplaceType | null;
  gender?: AvatarGender;
  onChangeGender?: (gender: AvatarGender) => void;
}) {
  const [browsingWorkType, setBrowsingWorkType] = useState<WorkplaceType>(
    avatarWorkType(avatarKey) ?? workType ?? "OFFICE",
  );
  const [internalGender, setInternalGender] = useState<AvatarGender>(avatarGender(avatarKey) ?? "MALE");
  const gender = controlledGender ?? internalGender;
  const colorInputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const choices = avatarChoices(browsingWorkType, gender);
  const customColor = customGradientColor(avatarGradient);

  function pickGender(next: AvatarGender) {
    setInternalGender(next);
    onChangeGender?.(next);
    const swapped = avatarKeyForGender(avatarKey, next);
    if (swapped && swapped !== avatarKey) onChangeAvatarKey(swapped);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[13px] font-semibold text-foreground">{t("Choose your avatar")}</p>
        <WorkTypeDots value={browsingWorkType} onChange={setBrowsingWorkType} />
        {controlledGender === undefined && (
          <div className="ml-auto">
            <GenderToggle value={gender} onChange={pickGender} />
          </div>
        )}
      </div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        {choices.map((v) => {
          const picked = avatarKey === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => onChangeAvatarKey(v.key)}
              aria-label={t(workplaceTypeLabel(browsingWorkType))}
              aria-pressed={picked}
              className={`relative aspect-square overflow-hidden rounded-full transition ${
                picked
                  ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface"
                  : "opacity-90 hover:opacity-100"
              }`}
              style={{ background: picked ? avatarGradientCss(avatarGradient) : "var(--color-surface-muted)" }}
            >
              <Image
                src={avatarImageUrl(v.key) ?? ""}
                alt=""
                width={192}
                height={192}
                unoptimized
                className="h-full w-full"
              />
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-[13px] font-semibold text-foreground">{t("Background")}</p>
      <div className="mb-2 grid grid-cols-6 gap-2">
        {AVATAR_GRADIENTS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => onChangeGradient(g.key)}
            aria-label={g.key}
            className={`aspect-square rounded-full transition ${
              avatarGradient === g.key ? "ring-1 ring-brand-600 ring-offset-2 ring-offset-surface" : ""
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
          aria-label={t("Pick a custom color")}
          title={t("Pick a custom color")}
          className={`relative aspect-square rounded-full transition ${
            customColor ? "ring-1 ring-brand-600 ring-offset-2 ring-offset-surface" : ""
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

/**
 * The four work types as small dots in their collar colours; the picked one
 * is larger with a ring, and its name is written after the dots.
 */
function WorkTypeDots({ value, onChange }: { value: WorkplaceType; onChange: (type: WorkplaceType) => void }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("Work type of the avatar")} className="flex items-center gap-1">
      {AVATAR_WORK_TYPES.map((type) => {
        const picked = type === value;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={t(workplaceTypeLabel(type))}
            title={t(workplaceTypeLabel(type))}
            onClick={() => onChange(type)}
            className="group flex h-6 w-6 items-center justify-center rounded-full"
          >
            <span
              className={`block rounded-full transition-all duration-150 ${collarTileTone[type].bar} ${
                picked
                  ? "h-3 w-3 ring-2 ring-foreground/25 ring-offset-2 ring-offset-surface"
                  : "h-2 w-2 opacity-45 group-hover:opacity-90"
              }`}
            />
          </button>
        );
      })}
      <span className="ml-1 text-xs text-muted-foreground">{t(workplaceTypeLabel(value))}</span>
    </div>
  );
}

/** The standard male (blue) and female (pink) symbols; the picked one gets a soft wash of its colour. */
export function GenderToggle({ value, onChange }: { value: AvatarGender; onChange: (gender: AvatarGender) => void }) {
  const t = useT();
  const options: { gender: AvatarGender; label: string; tone: string; wash: string }[] = [
    { gender: "MALE", label: "Male", tone: "text-blue-600 dark:text-blue-400", wash: "bg-blue-500/15" },
    { gender: "FEMALE", label: "Female", tone: "text-pink-500 dark:text-pink-400", wash: "bg-pink-500/15" },
  ];
  return (
    <div role="radiogroup" aria-label={t("Avatar gender")} className="flex items-center gap-1">
      {options.map((o) => {
        const picked = o.gender === value;
        return (
          <button
            key={o.gender}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={t(o.label)}
            title={t(o.label)}
            onClick={() => onChange(o.gender)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${o.tone} ${
              picked ? o.wash : "opacity-40 hover:opacity-80"
            }`}
          >
            {o.gender === "MALE" ? <MaleSymbol /> : <FemaleSymbol />}
          </button>
        );
      })}
    </div>
  );
}

// The plain Mars and Venus signs - a circle with an arrow, a circle with a cross.
function MaleSymbol() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="14" r="5.5" />
      <path d="M14 10 20 4M15 4h5v5" />
    </svg>
  );
}

function FemaleSymbol() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V21M9 18h6" />
    </svg>
  );
}

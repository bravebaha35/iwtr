"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { WorkplaceType } from "@iwtr/shared-types";
import { AVATAR_WORK_TYPES, avatarChoices, avatarImageUrl, avatarWorkType, type AvatarGender } from "@/lib/avatars";
import { AVATAR_GRADIENTS, avatarGradientCss, customGradientColor, customGradientKey } from "@/lib/avatarGradients";
import { collarTileTone } from "@/lib/collarColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { useT } from "@/lib/i18n/client";

/**
 * "Choose your avatar" (one of the four work types via the dots, then one of
 * 4 beavers of the member's own gender) -> "Background" (11 gradients + a
 * native color-picker popup for any exact color). Shared between onboarding's
 * AvatarPicker and the /me page's Customize tab. Gender is chosen at sign-up
 * (PiiForm) and changed under Personal Information, never here.
 */
export function AvatarEditor({
  avatarKey,
  avatarGradient,
  onChangeAvatarKey,
  onChangeGradient,
  workType,
  gender,
}: {
  avatarKey: string | null;
  avatarGradient: string | null;
  onChangeAvatarKey: (key: string) => void;
  onChangeGradient: (key: string) => void;
  // The work-type dot to start on when the current avatar doesn't say
  // (no avatar yet): the member's own work type, if known.
  workType?: WorkplaceType | null;
  gender: AvatarGender;
}) {
  const [browsingWorkType, setBrowsingWorkType] = useState<WorkplaceType>(
    avatarWorkType(avatarKey) ?? workType ?? "OFFICE",
  );
  const colorInputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const choices = avatarChoices(browsingWorkType, gender);
  const customColor = customGradientColor(avatarGradient);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[13px] font-semibold text-foreground">{t("Choose your avatar")}</p>
        <WorkTypeDots value={browsingWorkType} onChange={setBrowsingWorkType} />
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
export function WorkTypeDots({
  value,
  onChange,
  label = "Work type of the avatar",
}: {
  value: WorkplaceType;
  onChange: (type: WorkplaceType) => void;
  label?: string;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t(label)} className="flex items-center gap-1">
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
                  ? "h-3 w-3 ring-2 ring-brand-600 ring-offset-2 ring-offset-surface dark:ring-brand-400"
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

/**
 * Gender, as the standard male (blue) and female (pink) symbols with their
 * words. Used at sign-up (PiiForm) and under Personal Information; null =
 * not chosen yet.
 */
export function GenderToggle({
  value,
  onChange,
  locked = false,
}: {
  value: AvatarGender | null;
  onChange?: (gender: AvatarGender) => void;
  // Chosen at sign-up and fixed since: just the picked one, with a lock.
  locked?: boolean;
}) {
  const t = useT();
  const options: { gender: AvatarGender; label: string; tone: string; wash: string }[] = [
    { gender: "MALE", label: "Male", tone: "text-blue-600 dark:text-blue-400", wash: "bg-blue-500/15" },
    { gender: "FEMALE", label: "Female", tone: "text-pink-500 dark:text-pink-400", wash: "bg-pink-500/15" },
  ];
  if (locked) {
    const o = options.find((x) => x.gender === value);
    if (!o) return null;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-sm font-semibold text-foreground ${o.wash}`}>
        <span className={o.tone}>{o.gender === "MALE" ? <MaleSymbol /> : <FemaleSymbol />}</span>
        {t(o.label)}
        <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={t("Locked")}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label={t("Gender")} className="flex items-center gap-2">
      {options.map((o) => {
        const picked = o.gender === value;
        return (
          <button
            key={o.gender}
            type="button"
            role="radio"
            aria-checked={picked}
            onClick={() => onChange?.(o.gender)}
            className={`flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3.5 text-sm transition ${
              picked ? `${o.wash} font-semibold text-foreground` : "bg-surface-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`${o.tone} ${picked ? "" : "opacity-60"}`}>
              {o.gender === "MALE" ? <MaleSymbol /> : <FemaleSymbol />}
            </span>
            {t(o.label)}
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

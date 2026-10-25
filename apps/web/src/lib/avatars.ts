import { isRandomizedIdentityAvatarKey, type WorkplaceType } from "@iwtr/shared-types";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

// The "secret" beavers (sunglasses, black suit; randomized_identity and
// randomized_identity_f) show only on a review, comment or answer posted with
// a one-off random name - deliberately outside WORK_TYPE_AVATARS below so they
// can never be picked as an account's own avatar; only the server assigns
// them, by the author's gender (randomizedIdentityAvatarKey in shared-types).

export type AvatarGender = "MALE" | "FEMALE";

export interface AvatarVariant {
  key: string;
  gender: AvatarGender;
}

export interface WorkTypeAvatars {
  workType: WorkplaceType;
  variants: AvatarVariant[];
}

// Avatar picking: a gender (the male / female symbols), a work type (the four
// dots), then one of 4 beavers. The art is the owner's own (public/mal*.webp,
// public/fem*.webp), cropped to circles by scripts/crop-avatars.mjs into
// public/avatars/<key>.webp. `key` is the stored value (User.avatarKey) and
// must keep its work-type prefix ("office_", "remote_", "service_",
// "manual_"): the API reads the work type from it. Male keys are the
// original ones (office_1), so every existing account keeps a valid avatar;
// female keys add an "f" (office_f1).
const WORK_TYPE_KEY_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "remote",
  SERVICE: "service",
  MANUAL_LABOUR: "manual",
};

export const AVATAR_WORK_TYPES: WorkplaceType[] = ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"];

function variantsFor(workType: WorkplaceType): AvatarVariant[] {
  const prefix = WORK_TYPE_KEY_PREFIX[workType];
  return [
    ...[1, 2, 3, 4].map((n) => ({ key: `${prefix}_${n}`, gender: "MALE" as const })),
    ...[1, 2, 3, 4].map((n) => ({ key: `${prefix}_f${n}`, gender: "FEMALE" as const })),
  ];
}

export const WORK_TYPE_AVATARS: WorkTypeAvatars[] = AVATAR_WORK_TYPES.map((workType) => ({
  workType,
  variants: variantsFor(workType),
}));

function findVariant(avatarKey: string | null | undefined): { group: WorkTypeAvatars; variant: AvatarVariant } | null {
  if (!avatarKey) return null;
  for (const group of WORK_TYPE_AVATARS) {
    const variant = group.variants.find((v) => v.key === avatarKey);
    if (variant) return { group, variant };
  }
  return null;
}

/** The 4 beavers of one work type and gender, in picker order. */
export function avatarChoices(workType: WorkplaceType, gender: AvatarGender): AvatarVariant[] {
  return WORK_TYPE_AVATARS.find((g) => g.workType === workType)?.variants.filter((v) => v.gender === gender) ?? [];
}

/** The picture for an avatar key; "sm" is the 96px copy for small avatars. Null for unknown keys. */
export function avatarImageUrl(avatarKey: string | null | undefined, size: "sm" | "lg" = "lg"): string | null {
  if (!findVariant(avatarKey) && !isRandomizedIdentityAvatarKey(avatarKey)) return null;
  return size === "sm" ? `/avatars/sm/${avatarKey}.webp` : `/avatars/${avatarKey}.webp`;
}

export function avatarGender(avatarKey: string | null | undefined): AvatarGender | null {
  return findVariant(avatarKey)?.variant.gender ?? null;
}

/**
 * The same beaver number for the other gender (office_2 -> office_f2), so
 * switching gender changes the avatar straight away instead of leaving the
 * old pick in place.
 */
export function avatarKeyForGender(avatarKey: string | null | undefined, gender: AvatarGender): string | null {
  const found = findVariant(avatarKey);
  if (!found) return null;
  const n = found.variant.key.slice(-1);
  const prefix = WORK_TYPE_KEY_PREFIX[found.group.workType];
  return gender === "FEMALE" ? `${prefix}_f${n}` : `${prefix}_${n}`;
}

// The work type an avatarKey belongs to - drives which work-type dot is
// picked when re-opening the picker, and the header's fallback pseudo-name
// when no display name is set.
export function avatarWorkType(avatarKey: string | null | undefined): WorkplaceType | null {
  return findVariant(avatarKey)?.group.workType ?? null;
}

export function avatarLabel(avatarKey: string | null | undefined): string | null {
  const workType = avatarWorkType(avatarKey);
  return workType ? workplaceTypeLabel(workType) : null;
}

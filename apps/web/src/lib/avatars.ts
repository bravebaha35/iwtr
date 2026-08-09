import type { WorkplaceType } from "@iwtr/shared-types";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

export interface AvatarVariant {
  key: string;
  emoji: string;
}

export interface WorkTypeAvatars {
  workType: WorkplaceType;
  variants: AvatarVariant[];
}

// Avatar picking is two steps: pick a work type, then pick one of 4 variants
// within it (real illustrated art — e.g. four different "Beaver" looks per
// work type — is coming later; these emoji are placeholders). Swap any
// `emoji` value here for real artwork without touching anything else —
// `key` is the stable storage identifier (User.avatarKey).
export const WORK_TYPE_AVATARS: WorkTypeAvatars[] = [
  {
    workType: "OFFICE",
    variants: [
      { key: "office_1", emoji: "🏢" },
      { key: "office_2", emoji: "💼" },
      { key: "office_3", emoji: "🧑‍💻" },
      { key: "office_4", emoji: "📊" },
    ],
  },
  {
    workType: "HYBRID_REMOTE",
    variants: [
      { key: "remote_1", emoji: "💻" },
      { key: "remote_2", emoji: "🏠" },
      { key: "remote_3", emoji: "🛋️" },
      { key: "remote_4", emoji: "☕" },
    ],
  },
  {
    workType: "SERVICE",
    variants: [
      { key: "service_1", emoji: "🛎️" },
      { key: "service_2", emoji: "🍽️" },
      { key: "service_3", emoji: "🧑‍🍳" },
      { key: "service_4", emoji: "💇" },
    ],
  },
  {
    workType: "MANUAL_LABOUR",
    variants: [
      { key: "manual_1", emoji: "🛠️" },
      { key: "manual_2", emoji: "👷" },
      { key: "manual_3", emoji: "🚜" },
      { key: "manual_4", emoji: "🔧" },
    ],
  },
];

function findVariant(avatarKey: string | null | undefined): { group: WorkTypeAvatars; variant: AvatarVariant } | null {
  if (!avatarKey) return null;
  for (const group of WORK_TYPE_AVATARS) {
    const variant = group.variants.find((v) => v.key === avatarKey);
    if (variant) return { group, variant };
  }
  return null;
}

export function avatarEmoji(avatarKey: string | null | undefined): string | null {
  return findVariant(avatarKey)?.variant.emoji ?? null;
}

// The work type an avatarKey belongs to — drives which 4 variants are shown
// as already-selected when re-opening the picker, and the header's fallback
// pseudo-name when no display name is set.
export function avatarWorkType(avatarKey: string | null | undefined): WorkplaceType | null {
  return findVariant(avatarKey)?.group.workType ?? null;
}

export function avatarLabel(avatarKey: string | null | undefined): string | null {
  const workType = avatarWorkType(avatarKey);
  return workType ? workplaceTypeLabel(workType) : null;
}

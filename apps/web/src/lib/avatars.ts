// Final Phase 1→4 avatar set: distinct, non-identifying animal icons, each with
// its own color identity. No custom illustration pipeline exists yet, so these
// stay emoji-based — swap the `emoji` values for real artwork later without
// touching anything else (avatarKey values are stable storage identifiers).
export const AVATARS = [
  { key: "avatar_fox", emoji: "🦊", bg: "bg-orange-100 dark:bg-orange-900/60" },
  { key: "avatar_owl", emoji: "🦉", bg: "bg-amber-100 dark:bg-amber-900/60" },
  { key: "avatar_cat", emoji: "🐱", bg: "bg-rose-100 dark:bg-rose-900/60" },
  { key: "avatar_panda", emoji: "🐼", bg: "bg-slate-100 dark:bg-slate-800" },
  { key: "avatar_lion", emoji: "🦁", bg: "bg-yellow-100 dark:bg-yellow-900/60" },
  { key: "avatar_penguin", emoji: "🐧", bg: "bg-sky-100 dark:bg-sky-900/60" },
  { key: "avatar_koala", emoji: "🐨", bg: "bg-stone-100 dark:bg-stone-800" },
  { key: "avatar_bear", emoji: "🐻", bg: "bg-emerald-100 dark:bg-emerald-900/60" },
  { key: "avatar_rabbit", emoji: "🐰", bg: "bg-pink-100 dark:bg-pink-900/60" },
  { key: "avatar_turtle", emoji: "🐢", bg: "bg-teal-100 dark:bg-teal-900/60" },
  { key: "avatar_dolphin", emoji: "🐬", bg: "bg-indigo-100 dark:bg-indigo-900/60" },
  { key: "avatar_octopus", emoji: "🐙", bg: "bg-violet-100 dark:bg-violet-900/60" },
] as const;

export function avatarEmoji(avatarKey: string | null | undefined): string | null {
  return AVATARS.find((a) => a.key === avatarKey)?.emoji ?? null;
}

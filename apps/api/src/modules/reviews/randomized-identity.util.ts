import type { WorkplaceType } from "@iwtr/shared-types";

// Backing pool for RateButton.tsx's "randomize my avatar and username for
// this review" toggle — one list per WorkplaceType, deliberately separate
// from moderation.service.ts (that module governs content *rejection*; this
// is display-only cosmetic text with no moderation role).
const RANDOM_DISPLAY_USERNAMES: Record<WorkplaceType, string[]> = {
  OFFICE: [
    "Chief Happiness Officer",
    "Spreadsheet Maestro",
    "Coffee Machine Whisperer",
    "Reply-All Enthusiast",
    "Meeting Survivor",
    "PowerPoint Picasso",
    "Desk Plant Parent",
    "Watercooler Diplomat",
    "BCC Ninja",
    "Inbox Zero Hero",
  ],
  HYBRID_REMOTE: [
    "Pajama Executive",
    "Zoom Mute Master",
    "Wi-Fi Nomad",
    "Sofa Surfer",
    "Virtual Background Artist",
    "Keyboard Cat",
    "Timezone Traveler",
    "Screen Share Strategist",
    "Webcam Avoider",
    "Router Rebooter",
  ],
  SERVICE: [
    "Customer Whisperer",
    "Smile Ambassador",
    "Patience Practitioner",
    "Receipt Magician",
    "The Floor General",
    "Karen's Nemesis",
    "Shift Survivor",
    "Name Tag Ninja",
    "The Apology Artist",
    "Small Talk Specialist",
  ],
  MANUAL_LABOUR: [
    "Heavy Lifter Extraordinaire",
    "The Toolbox Tamer",
    "Forklift Philosopher",
    "Callus Collector",
    "Hard Hat Hero",
    "Duct Tape Magician",
    "The Blueprint Boss",
    "Steel Toe Sprinter",
    "WD-40 Wizard",
    "Early Morning Engine",
  ],
};

// Not cryptographic — this is cosmetic display text, not a secret or a
// security token, so Math.random() is the right tool rather than a CSPRNG.
export function pickRandomDisplayUsername(workplaceType: WorkplaceType): string {
  const pool = RANDOM_DISPLAY_USERNAMES[workplaceType];
  return pool[Math.floor(Math.random() * pool.length)];
}

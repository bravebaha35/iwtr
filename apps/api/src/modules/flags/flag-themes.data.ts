import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";

/**
 * The Workplace Vibe Flag themes (v2, 2026-10-24, rebuilt from scratch for
 * the revised question set). Each survey category has two themes ("slots"),
 * each built from 1-3 of that category's questions (ids per
 * survey-questions.data.ts). A theme becomes a GREEN flag, a RED flag or no
 * flag at all, depending on how clearly reviewers agree (see
 * flag-calculator.service.ts) - most companies will not have a flag for
 * every theme.
 *
 * Wording rules (Turkish law): a flag is a summary of what reviewers report,
 * never a legal finding about the company. No label says "illegal", "theft",
 * "fraud" or names a crime - those are accusations a company could challenge
 * as defamation (TCK 125, TMK 24-25). Red labels say what reviewers report
 * ("Unpaid overtime reported"), green labels what they describe.
 *
 * `legal` lists the questions whose healthy answer is a minimum Turkish law
 * requires of every employer (İş Kanunu 4857, İSG Kanunu 6331 and their
 * regulations). A theme with one of them turns red sooner and green later:
 * meeting a legal minimum is expected, falling short of it matters more.
 *
 * The Turkish for every label and topic is in apps/web
 * (lib/i18n/tr/flags.ts), keyed by the English text.
 */
export interface FlagTheme {
  category: CategoryKey;
  slot: 1 | 2;
  /** Question numbers within the category (1-5). */
  questions: number[];
  /** Question numbers (subset of `questions`) that are legal minimums. */
  legal?: number[];
  /** What the theme is about, for a "split opinions" note. */
  topic: string;
  green: string;
  red: string;
}

const t = (
  category: CategoryKey,
  slot: 1 | 2,
  questions: number[],
  topic: string,
  green: string,
  red: string,
  legal?: number[],
): FlagTheme => ({ category, slot, questions, topic, green, red, legal });

export const FLAG_THEMES: Record<WorkplaceType, FlagTheme[]> = {
  OFFICE: [
    t("corporateCulture", 1, [1, 2], "merit and fairness", "Merit over politics", "Politics over merit"),
    t("corporateCulture", 2, [3, 4, 5], "speaking up and recognition", "Safe to speak up", "Speaking up feels risky"),
    t("leadership", 1, [2, 3], "accountability and feedback", "Managers own their mistakes", "Blame flows downhill"),
    t("leadership", 2, [1, 4, 5], "trust and transparency", "Trusting, transparent managers", "Micromanaged and kept in the dark"),
    t("infrastructure", 1, [1, 5], "computers and IT help", "Working tech, quick IT help", "Tech slows the work down"),
    t("infrastructure", 2, [2, 3, 4], "the office itself", "A well-kept, focused office", "Neglected office basics"),
    // Overtime must be paid (or given back as time off) - İş Kanunu m.41.
    t("workLifeBalance", 1, [2], "overtime pay", "Overtime is paid", "Unpaid overtime reported", [2]),
    t("workLifeBalance", 2, [1, 3, 4, 5], "personal time and flexibility", "Flexible, respected hours", "Always-on expectations"),
    t("stability", 1, [1, 2, 5], "stability and openness about changes", "Steady and open about changes", "An unsettled future"),
    t("stability", 2, [3, 4], "pay reviews and growth", "Clear pay reviews and growth", "Stalled pay and growth"),
  ],
  HYBRID_REMOTE: [
    t("corporateCulture", 1, [1, 2], "trust and equal treatment", "Trusted and treated equally", "Remote staff watched or sidelined"),
    t("corporateCulture", 2, [3, 4, 5], "respect for your time and pace", "Respects your time and pace", "Pressure to be always available"),
    t("leadership", 1, [1, 2, 3], "how managers judge and run the work", "Judged on results, not status dots", "Activity watched over results"),
    t("leadership", 2, [4, 5], "honesty and care from leadership", "Honest, caring leadership", "Burnout and silence from the top"),
    // Equipment and costs for remote work: Uzaktan Çalışma Yönetmeliği,
    // unless agreed otherwise - not a hard minimum, so not marked legal.
    t("infrastructure", 1, [1, 4], "the remote setup", "A properly equipped setup", "Left to sort out your own setup"),
    t("infrastructure", 2, [2, 3, 5], "remote tools and documents", "Smooth remote tools", "Unreliable remote tools"),
    // Unpaid hours: İş Kanunu m.41.
    t("workLifeBalance", 1, [1, 3], "the end of the workday", "A real end to the workday", "Unpaid hours creep in", [1]),
    t("workLifeBalance", 2, [2, 4, 5], "workload and office days", "A sustainable, flexible workload", "Pressure without a purpose"),
    // Equal pay for the same work: İş Kanunu m.5, Uzaktan Çalışma Yönetmeliği.
    t("stability", 1, [2, 3], "equal pay and growth for remote staff", "Equal pay and growth", "Remote staff treated as second class", [2]),
    t("stability", 2, [1, 4, 5], "the future of remote work here", "A stable remote future", "A shaky remote future"),
  ],
  SERVICE: [
    t("corporateCulture", 1, [1, 2], "backing staff up", "Staff are backed up", "Staff left exposed"),
    t("corporateCulture", 2, [3, 4, 5], "targets and fairness on the floor", "Fair, realistic expectations", "Unfair pressure on the floor"),
    t("leadership", 1, [1, 3], "the same rules for everyone", "Same rules for everyone", "Favouritism reported"),
    // Protecting staff from harassment: Türk Borçlar Kanunu m.417.
    t("leadership", 2, [2, 4, 5], "managers stepping in", "Present, responsive managers", "Managers don't step in", [4]),
    t("infrastructure", 1, [1, 3], "tools and stock", "Tools and stock ready", "Failing tools, missing stock"),
    // Safety measures (İSG Kanunu 6331) and rest breaks (İş Kanunu m.68).
    t("infrastructure", 2, [2, 4, 5], "breaks and safety", "Safe, humane conditions", "Breaks and safety slip", [4, 5]),
    // Weekly rest day (m.46), 11 hours' rest between shifts (Çalışma Süreleri
    // Yönetmeliği), overtime only with the worker's consent.
    t("workLifeBalance", 1, [2, 3, 4], "rest days and overtime", "Rest days and overtime respected", "Pressure on rest days and overtime", [2, 3, 4]),
    t("workLifeBalance", 2, [1, 5], "schedules", "Predictable schedules", "Last-minute schedules"),
    // Wages and overtime paid in full: İş Kanunu m.32, m.41.
    t("stability", 1, [1, 2], "pay, overtime and tips", "Transparent, accurate pay", "Concerns about pay and tips", [1]),
    t("stability", 2, [3, 4, 5], "staffing and room to grow", "A stable team with room to grow", "Constant staff churn"),
  ],
  MANUAL_LABOUR: [
    // Safety first, workers' rights, injured workers: İSG Kanunu 6331,
    // Sendikalar Kanunu 6356.
    t("corporateCulture", 1, [1, 3, 4], "safety and workers' rights", "Safety and rights respected", "Safety and rights at risk", [1, 3, 4]),
    t("corporateCulture", 2, [2, 5], "how the crew treats people", "A respectful crew", "Hazing or hostility reported"),
    t("leadership", 1, [1, 2], "foremen and fair task sharing", "Experienced, fair foremen", "Unfair or inexperienced foremen"),
    // Hazards removed once reported: İSG Kanunu m.4.
    t("leadership", 2, [3, 4, 5], "dealing with hazards", "Hazards dealt with fast", "Hazards left unresolved", [4]),
    // Free PPE, drinking water and toilets, first aid: İSG Kanunu 6331 and
    // its regulations.
    t("infrastructure", 1, [2, 3, 5], "PPE, water and first aid", "PPE, water and first aid provided", "Missing PPE or site basics", [2, 3, 5]),
    t("infrastructure", 2, [1, 4], "machines and materials", "Safe machines, steady supplies", "Unsafe machines or supply gaps", [1]),
    // Daily hours, rest breaks (m.68) and rest between shifts.
    t("workLifeBalance", 1, [1, 3, 5], "shift length and breaks", "Humane shifts and breaks", "Exhausting shifts, short breaks", [1, 3, 5]),
    // Overtime needs consent; travel to a distant site counts as work (m.66).
    t("workLifeBalance", 2, [2, 4], "overtime and travel time", "Overtime by choice, travel paid", "Forced overtime or unpaid travel", [2, 4]),
    // Wages in full and on time (m.32, m.34); work accidents reported to SGK
    // within 3 working days (6331 m.14).
    t("stability", 1, [1, 4], "pay and incident reports", "Paid right, incidents recorded", "Problems with pay or incident reports", [1, 4]),
    t("stability", 2, [2, 3, 5], "steady, sustainable work", "Steady, sustainable work", "Unsteady, wearing work"),
  ],
};

export function themesFor(workplaceType: WorkplaceType, category?: CategoryKey): FlagTheme[] {
  const all = FLAG_THEMES[workplaceType];
  return category ? all.filter((theme) => theme.category === category) : all;
}

export function themeQuestionIds(workplaceType: WorkplaceType, theme: FlagTheme): string[] {
  return theme.questions.map((n) => `${workplaceType}.${theme.category}.${n}`);
}

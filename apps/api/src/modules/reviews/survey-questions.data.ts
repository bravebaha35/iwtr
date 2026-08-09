import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";

export interface SurveyQuestion {
  id: string;
  category: CategoryKey;
  text: string;
  correctAnswer: "YES" | "NO";
}

/**
 * The full question bank, including each question's "correct" (i.e.
 * healthy-workplace) answer. Deliberately kept in apps/api only — never
 * imported by apps/web or packages/shared-types — so the answer key never
 * ships in the client bundle. Scores are always computed server-side from
 * the reviewer's submitted answers (see ReviewsService.scoreAnswers); the
 * client only ever sees the question text via the stripped public shape
 * (getPublicQuestions below).
 *
 * `id` is deterministic (`${workplaceType}.${category}.${n}`) so it stays
 * stable across app restarts/edits — a review's stored surveyAnswers are
 * keyed by these ids.
 */
const SURVEY_QUESTIONS: Record<WorkplaceType, SurveyQuestion[]> = {
  OFFICE: [
    // Corporate Culture
    q("OFFICE", "corporateCulture", 1, "Is staying late or sitting at your desk past official hours rewarded over actual work output?", "YES"),
    q("OFFICE", "corporateCulture", 2, "Have you personally witnessed office politics or favoritism dictate promotions over merit?", "NO"),
    q("OFFICE", "corporateCulture", 3, "Can employees openly criticize company decisions in meetings without fear of retaliation?", "YES"),
    q("OFFICE", "corporateCulture", 4, "Does company management actually practice the corporate values they preach publicly?", "YES"),
    q("OFFICE", "corporateCulture", 5, "Is credit-stealing or backstabbing common within your team?", "NO"),
    // Leadership & Management
    q("OFFICE", "leadership", 1, "Does middle management actively micromanage your daily tasks?", "YES"),
    q("OFFICE", "leadership", 2, "When a project fails, do leaders take responsibility instead of blaming subordinates?", "YES"),
    q("OFFICE", "leadership", 3, "Do managers provide actionable, constructive feedback rather than vague performance reviews?", "YES"),
    q("OFFICE", "leadership", 4, "Are major leadership decisions communicated transparently before taking effect?", "YES"),
    q("OFFICE", "leadership", 5, "Does your direct manager protect you from unreasonable workload spikes from executives?", "YES"),
    // Infrastructure & Resources
    q("OFFICE", "infrastructure", 1, "Is your daily work frequently delayed by outdated computer hardware or slow software?", "NO"),
    q("OFFICE", "infrastructure", 2, "Is the physical office environment quiet and comfortable enough for deep focus?", "YES"),
    q("OFFICE", "infrastructure", 3, "Are basic office supplies and meeting room equipment consistently maintained?", "YES"),
    q("OFFICE", "infrastructure", 4, "Does a clear, centralized internal wiki or knowledge base exist for your team's processes?", "YES"),
    q("OFFICE", "infrastructure", 5, "Does IT support resolve critical, work-blocking technical issues in a timely manner?", "YES"),
    // Work-Life Balance
    q("OFFICE", "workLifeBalance", 1, "Are you expected to read or respond to work messages outside of official working hours?", "NO"),
    q("OFFICE", "workLifeBalance", 2, "Is uncompensated overtime regularly expected in your role?", "NO"),
    q("OFFICE", "workLifeBalance", 3, "Can you take fully approved PTO without being contacted about work tasks?", "YES"),
    q("OFFICE", "workLifeBalance", 4, "Does management allow flexibility for personal or medical appointments during the day?", "YES"),
    q("OFFICE", "workLifeBalance", 5, "Does management track physical seat time or online status icons over actual deliverables?", "NO"),
    // Organizational Stability
    q("OFFICE", "stability", 1, "Has your department experienced high turnover or silent firings in the past 12 months?", "NO"),
    q("OFFICE", "stability", 2, "Does the company frequently change its strategic direction or pivot chaotically?", "NO"),
    q("OFFICE", "stability", 3, "Are salary reviews and compensation adjustments conducted on a predictable schedule?", "YES"),
    q("OFFICE", "stability", 4, "Does the company actively fund career growth or internal job promotions?", "YES"),
    q("OFFICE", "stability", 5, "Do you feel confident your job will still exist at this company 12 months from now?", "YES"),
  ],
  HYBRID_REMOTE: [
    // Corporate Culture
    q("HYBRID_REMOTE", "corporateCulture", 1, "Does management trust remote employees without using digital tracking or surveillance software?", "YES"),
    q("HYBRID_REMOTE", "corporateCulture", 2, "Do in-office employees receive preferential treatment or faster promotions over remote staff?", "NO"),
    q("HYBRID_REMOTE", "corporateCulture", 3, "Does the company respect asynchronous communication, allowing time to reply without pressure?", "YES"),
    q("HYBRID_REMOTE", "corporateCulture", 4, "Does management respect your local timezone boundaries when scheduling calls or assigning tasks?", "YES"),
    q("HYBRID_REMOTE", "corporateCulture", 5, "Is remote socialization purely optional without social penalties for non-attendance?", "YES"),
    // Leadership & Management
    q("HYBRID_REMOTE", "leadership", 1, "Does leadership evaluate your performance strictly by work outcomes rather than online activity dots?", "YES"),
    q("HYBRID_REMOTE", "leadership", 2, "Are virtual team meetings run with clear agendas and kept within set time limits?", "YES"),
    q("HYBRID_REMOTE", "leadership", 3, "Does your manager respond to messages and support requests within a reasonable timeframe?", "YES"),
    q("HYBRID_REMOTE", "leadership", 4, "Does leadership actively step in when a remote employee shows clear signs of burnout?", "YES"),
    q("HYBRID_REMOTE", "leadership", 5, "Is company leadership honest and transparent during virtual town halls and written updates?", "YES"),
    // Infrastructure & Resources
    q("HYBRID_REMOTE", "infrastructure", 1, "Did the company provide a proper stipend or high-quality hardware for your remote setup?", "YES"),
    q("HYBRID_REMOTE", "infrastructure", 2, "Are cloud tools, VPNs, and internal software reliable and fast to access?", "YES"),
    q("HYBRID_REMOTE", "infrastructure", 3, "Is internal company documentation clear enough for you to solve problems independently?", "YES"),
    q("HYBRID_REMOTE", "infrastructure", 4, "Can remote IT support fix account access or device issues without long delays?", "YES"),
    q("HYBRID_REMOTE", "infrastructure", 5, "Are digital collaboration tools (Slack, Teams, Jira) structured logically rather than chaotic?", "YES"),
    // Work-Life Balance
    q("HYBRID_REMOTE", "workLifeBalance", 1, "Do the lines between your personal life and workday frequently blur into unpaid work hours?", "NO"),
    q("HYBRID_REMOTE", "workLifeBalance", 2, "Can you step away from your computer during the day without feeling anxious about your status icon?", "YES"),
    q("HYBRID_REMOTE", "workLifeBalance", 3, 'Does the company enforce a genuine "right to disconnect" after your working day ends?', "YES"),
    q("HYBRID_REMOTE", "workLifeBalance", 4, "Is your assigned workload realistically manageable within a standard work week?", "YES"),
    q("HYBRID_REMOTE", "workLifeBalance", 5, "Are hybrid employees forced into mandatory in-office days that serve no practical purpose?", "NO"),
    // Organizational Stability
    q("HYBRID_REMOTE", "stability", 1, "Is there constant management talk or threats of forced Return-to-Office mandates?", "NO"),
    q("HYBRID_REMOTE", "stability", 2, "Are remote employees paid equally compared to in-office peers in the same role?", "YES"),
    q("HYBRID_REMOTE", "stability", 3, "Do fully remote workers have equal access to mentorship and career advancement?", "YES"),
    q("HYBRID_REMOTE", "stability", 4, "Is company financial performance communicated clearly and honestly to remote staff?", "YES"),
    q("HYBRID_REMOTE", "stability", 5, "Are you worried your remote role might be offshored or eliminated without warning?", "NO"),
  ],
  SERVICE: [
    // Corporate Culture
    q("SERVICE", "corporateCulture", 1, "Does management take the worker's side when dealing with abusive or aggressive customers?", "YES"),
    q("SERVICE", "corporateCulture", 2, "Is the working environment on the floor supportive rather than competitive or toxic?", "YES"),
    q("SERVICE", "corporateCulture", 3, "Are service speed targets set at realistic levels that don't force dangerous shortcuts?", "YES"),
    q("SERVICE", "corporateCulture", 4, "Are shift assignments and weekend duties distributed fairly without supervisor bias?", "YES"),
    q("SERVICE", "corporateCulture", 5, "Does management publicly acknowledge and reward hard work on the floor?", "YES"),
    // Leadership & Management
    q("SERVICE", "leadership", 1, "Do shift supervisors play favorites when scheduling shifts or assigning tasks?", "NO"),
    q("SERVICE", "leadership", 2, "Do managers step onto the floor to help the team during peak busy hours?", "YES"),
    q("SERVICE", "leadership", 3, "Are company policies enforced consistently across all employees without double standards?", "YES"),
    q("SERVICE", "leadership", 4, "Does management act immediately when internal harassment or bullying is reported?", "YES"),
    q("SERVICE", "leadership", 5, "Does management listen and adjust when front-line workers point out operational problems?", "YES"),
    // Infrastructure & Resources
    q("SERVICE", "infrastructure", 1, "Do POS systems, registers, or service equipment frequently crash during busy shifts?", "NO"),
    q("SERVICE", "infrastructure", 2, "Are employee break areas clean, sanitary, and physically separate from customers?", "YES"),
    q("SERVICE", "infrastructure", 3, "Is essential product inventory or operational supplies consistently stocked?", "YES"),
    q("SERVICE", "infrastructure", 4, "Are physical safety protocols and security measures strictly maintained on site?", "YES"),
    q("SERVICE", "infrastructure", 5, "Are mandatory rest breaks consistently granted during intense shifts?", "YES"),
    // Work-Life Balance
    q("SERVICE", "workLifeBalance", 1, "Are work schedules posted at least two weeks in advance?", "YES"),
    q("SERVICE", "workLifeBalance", 2, "Are you repeatedly pressured to cover shifts on your scheduled days off?", "NO"),
    q("SERVICE", "workLifeBalance", 3, 'Does management avoid scheduling "clopening" shifts (closing late and opening early next morning)?', "YES"),
    q("SERVICE", "workLifeBalance", 4, "Is overtime strictly voluntary rather than forced on short notice under threat of penalties?", "YES"),
    q("SERVICE", "workLifeBalance", 5, "Does management respect your personal schedule commitments outside of work?", "YES"),
    // Organizational Stability
    q("SERVICE", "stability", 1, "Have you ever experienced wage theft, stolen tips, or unrecorded work hours at this job?", "NO"),
    q("SERVICE", "stability", 2, "Are tips, commissions, or bonuses paid out accurately and transparently?", "YES"),
    q("SERVICE", "stability", 3, "Is the workplace constantly understaffed due to high employee turnover?", "NO"),
    q("SERVICE", "stability", 4, "Is there a clear, realistic path to advance from floor staff to supervisor roles?", "YES"),
    q("SERVICE", "stability", 5, "Do you feel confident this business location will remain open and financially solvent?", "YES"),
  ],
  MANUAL_LABOUR: [
    // Corporate Culture
    q("MANUAL_LABOUR", "corporateCulture", 1, "Is physical health and safety genuinely prioritized over production speed or deadlines?", "YES"),
    q("MANUAL_LABOUR", "corporateCulture", 2, "Is the job site free from hazing, harassment, and toxic machismo behavior?", "YES"),
    q("MANUAL_LABOUR", "corporateCulture", 3, "Does management fully respect labor rights, union standards, and safety regulations?", "YES"),
    q("MANUAL_LABOUR", "corporateCulture", 4, "Are injured workers treated fairly and supported without fear of job retaliation?", "YES"),
    q("MANUAL_LABOUR", "corporateCulture", 5, "Does the crew work as a supportive unit rather than being pitted against each other with metrics?", "YES"),
    // Leadership & Management
    q("MANUAL_LABOUR", "leadership", 1, "Do site foremen and managers have actual hands-on, practical experience in the work?", "YES"),
    q("MANUAL_LABOUR", "leadership", 2, "Is physically grueling, dirty, or dangerous work assigned fairly among workers?", "YES"),
    q("MANUAL_LABOUR", "leadership", 3, "Do managers follow the exact same safety rules they enforce on the crew?", "YES"),
    q("MANUAL_LABOUR", "leadership", 4, "Are unsafe site conditions or broken gear fixed immediately upon being reported?", "YES"),
    q("MANUAL_LABOUR", "leadership", 5, "Are daily safety briefings clear, realistic, and focused on actual hazard prevention?", "YES"),
    // Infrastructure & Resources
    q("MANUAL_LABOUR", "infrastructure", 1, "Are heavy machinery, vehicles, and power tools regularly serviced and safe to operate?", "YES"),
    q("MANUAL_LABOUR", "infrastructure", 2, "Does the employer supply all required personal protective equipment (PPE) free of charge?", "YES"),
    q("MANUAL_LABOUR", "infrastructure", 3, "Are clean drinking water, shade/shelter, and functional toilets provided on site?", "YES"),
    q("MANUAL_LABOUR", "infrastructure", 4, "Are raw materials delivered on time so you aren't forced to improvise dangerously?", "YES"),
    q("MANUAL_LABOUR", "infrastructure", 5, "Are emergency first aid kits and safety equipment fully stocked and accessible on site?", "YES"),
    // Work-Life Balance
    q("MANUAL_LABOUR", "workLifeBalance", 1, "Are shift lengths reasonable enough to prevent severe, accident-causing physical exhaustion?", "YES"),
    q("MANUAL_LABOUR", "workLifeBalance", 2, "Can you decline mandatory overtime without threat of termination or disciplinary action?", "YES"),
    q("MANUAL_LABOUR", "workLifeBalance", 3, "Are mandatory hydration and rest breaks strictly enforced throughout the shift?", "YES"),
    q("MANUAL_LABOUR", "workLifeBalance", 4, "Is travel time to distant job sites or temporary locations properly compensated?", "YES"),
    q("MANUAL_LABOUR", "workLifeBalance", 5, "Does the work pace allow your body sufficient recovery time between shifts?", "YES"),
    // Organizational Stability
    q("MANUAL_LABOUR", "stability", 1, "Is your paycheck always 100% accurate, paid on time, and fully accounting for overtime/hazard pay?", "YES"),
    q("MANUAL_LABOUR", "stability", 2, "Is employment consistent year-round rather than chaotic hire-and-fire cycles?", "YES"),
    q("MANUAL_LABOUR", "stability", 3, "Does the company pay for trade training, safety certifications, or skill upgrades?", "YES"),
    q("MANUAL_LABOUR", "stability", 4, "Does the company hold full workers' compensation and liability insurance?", "YES"),
    q("MANUAL_LABOUR", "stability", 5, "Do you believe your body can safely sustain working for this company for the next 5 years?", "YES"),
  ],
};

function q(
  workplaceType: WorkplaceType,
  category: CategoryKey,
  n: number,
  text: string,
  correctAnswer: "YES" | "NO",
): SurveyQuestion {
  return { id: `${workplaceType}.${category}.${n}`, category, text, correctAnswer };
}

export function getQuestionsFor(workplaceType: WorkplaceType): SurveyQuestion[] {
  return SURVEY_QUESTIONS[workplaceType];
}

/** Public shape sent to the client — never includes correctAnswer. */
export function getPublicQuestionsFor(workplaceType: WorkplaceType): { id: string; category: CategoryKey; text: string }[] {
  return getQuestionsFor(workplaceType).map(({ id, category, text }) => ({ id, category, text }));
}

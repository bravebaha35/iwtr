// Content library for the DB-driven company-description engine
// (PatternGeneratorService) — replaces the old Claude-generated narrative.
// Every sentence below is hand-written, conversational prose; nothing here
// is templated/lorem text, per the "no meaningless filler" requirement.
//
// Delete-all + re-insert on every run (not upsert): this table is 100%
// authored template content, never user data, so there's nothing to lose by
// resetting it to exactly what's below. Safe to re-run any time.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-summary-patterns.ts

import "dotenv/config";
import { PrismaClient, WorkplaceType, SummaryPatternCategory } from "@prisma/client";
import type { CategoryKey } from "@iwtr/shared-types";

const prisma = new PrismaClient();

type Direction = "AGREE" | "DISAGREE";
type Color = "GREEN" | "RED";

interface Row {
  workplaceType: WorkplaceType;
  category: SummaryPatternCategory;
  qnaKey: string | null;
  flagKey: string | null;
  textBlock: string;
}

const rows: Row[] = [];

function questionId(wt: WorkplaceType, category: CategoryKey, n: number): string {
  return `${wt}.${category}.${n}`;
}

function qna(
  wt: WorkplaceType,
  tier: "QNA_PRIMARY" | "QNA_SECONDARY",
  category: CategoryKey,
  n: number,
  direction: Direction,
  textBlock: string,
) {
  rows.push({ workplaceType: wt, category: tier, qnaKey: `${questionId(wt, category, n)}:${direction}`, flagKey: null, textBlock });
}

function flagRow(wt: WorkplaceType, category: CategoryKey, cluster: 1 | 2, color: Color, textBlock: string) {
  rows.push({ workplaceType: wt, category: "FLAG_FALLBACK", qnaKey: null, flagKey: `${category}:${cluster}:${color}`, textBlock });
}

function intro(wt: WorkplaceType, textBlock: string) {
  rows.push({ workplaceType: wt, category: "INTRO", qnaKey: `${wt}:INTRO`, flagKey: null, textBlock });
}

function conclusion(wt: WorkplaceType, textBlock: string) {
  rows.push({ workplaceType: wt, category: "CONCLUSION", qnaKey: `${wt}:CONCLUSION`, flagKey: null, textBlock });
}

// ===================== OFFICE =====================
{
  const wt: WorkplaceType = "OFFICE";
  intro(wt, "Opinions on this workplace are still fairly evenly split, with employees pointing to a genuine mix of strengths and problems.");
  intro(wt, "Reviews here are still a mixed bag overall.");
  conclusion(wt, "This is a stable environment for career growth, but you must aggressively set boundaries to protect your personal time.");
  conclusion(wt, "A solid role here, if you're willing to protect your own time.");

  qna(wt, "QNA_PRIMARY", "corporateCulture", 3, "AGREE", "Employees here can openly push back on a company decision in a meeting without it coming back to bite them later.");
  qna(wt, "QNA_PRIMARY", "corporateCulture", 3, "DISAGREE", "Speaking up against a decision here tends to be remembered, and not in your favor.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 4, "AGREE", "Management actually lives up to the values they post on the wall, not just talks about them.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 4, "DISAGREE", "The values printed on the website rarely match how management actually behaves day to day.");

  qna(wt, "QNA_PRIMARY", "leadership", 3, "AGREE", "Managers here give feedback you can actually act on, not just a vague \"good job\" or \"needs improvement.\"");
  qna(wt, "QNA_PRIMARY", "leadership", 3, "DISAGREE", "Performance feedback here tends to be vague and unhelpful, leaving you unsure what to actually change.");
  qna(wt, "QNA_SECONDARY", "leadership", 2, "AGREE", "When a project goes wrong, leadership owns it instead of pinning the blame on whoever's below them.");
  qna(wt, "QNA_SECONDARY", "leadership", 2, "DISAGREE", "When something goes wrong, blame tends to roll downhill onto whoever's easiest to point at.");

  qna(wt, "QNA_PRIMARY", "infrastructure", 5, "AGREE", "IT support actually shows up fast when something work-blocking breaks, instead of leaving you stuck for days.");
  qna(wt, "QNA_PRIMARY", "infrastructure", 5, "DISAGREE", "A work-blocking IT problem here can sit unresolved for days before anyone gets back to you.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "AGREE", "The office itself is quiet and comfortable enough to actually get focused work done.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "DISAGREE", "The office floor is noisy enough that real focused work is hard to come by.");

  qna(wt, "QNA_PRIMARY", "workLifeBalance", 2, "AGREE", "Overtime here is the exception, not the expectation, and you're not quietly pressured into working for free.");
  qna(wt, "QNA_PRIMARY", "workLifeBalance", 2, "DISAGREE", "The major downside is an intense culture that expects uncompensated overtime and after-hours communication.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 3, "AGREE", "Once your time off is approved, it's actually respected — no one pings you about work while you're out.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 3, "DISAGREE", "Approved time off doesn't stop the messages from rolling in about work anyway.");

  qna(wt, "QNA_PRIMARY", "stability", 5, "AGREE", "Most people here feel genuinely confident their job will still be around a year from now.");
  qna(wt, "QNA_PRIMARY", "stability", 5, "DISAGREE", "There's a real, ongoing sense that your role could disappear with little warning.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "AGREE", "Pay reviews happen on a predictable schedule here, not whenever someone remembers to run them.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "DISAGREE", "Raises and pay reviews happen unpredictably, if they happen at all.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Promotions here follow the work people actually do, not who they sit next to.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "People can question a decision in a meeting and still feel safe, and good work gets noticed.");
  flagRow(wt, "corporateCulture", 1, "RED", "Reviewers feel office politics and visible hours count for more than results when it comes to moving up.");
  flagRow(wt, "corporateCulture", 2, "RED", "Reviewers describe speaking up as risky, and say good work too often goes unrecognized.");

  flagRow(wt, "leadership", 1, "GREEN", "Managers here own their mistakes and give feedback you can actually act on.");
  flagRow(wt, "leadership", 2, "GREEN", "Managers trust people with their work and explain big decisions before they land.");
  flagRow(wt, "leadership", 1, "RED", "When things go wrong, reviewers say the blame tends to land on whoever is below.");
  flagRow(wt, "leadership", 2, "RED", "Reviewers describe close micromanagement and decisions that arrive without explanation.");

  flagRow(wt, "infrastructure", 1, "GREEN", "The computers work and IT fixes blocking problems quickly.");
  flagRow(wt, "infrastructure", 2, "GREEN", "The office is quiet, well kept and its processes are written down.");
  flagRow(wt, "infrastructure", 1, "RED", "Slow equipment and slow IT help hold up the day's work, reviewers say.");
  flagRow(wt, "infrastructure", 2, "RED", "Reviewers point to a noisy, poorly kept office and missing basic documentation.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Overtime, when it happens, is paid.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Evenings and time off are respected, and there is room for a doctor's appointment in the day.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Several reviewers report being expected to work extra hours without pay.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Reviewers describe being expected to stay reachable after hours and during time off.");

  flagRow(wt, "stability", 1, "GREEN", "The company is steady and open about changes in the team.");
  flagRow(wt, "stability", 2, "GREEN", "Pay reviews come on a predictable schedule and there is a visible path to grow.");
  flagRow(wt, "stability", 1, "RED", "Reviewers describe frequent changes of direction and uncertainty about what comes next.");
  flagRow(wt, "stability", 2, "RED", "Reviewers say pay reviews are unpredictable and growth opportunities are thin.");
}

// ===================== HYBRID_REMOTE =====================
{
  const wt: WorkplaceType = "HYBRID_REMOTE";
  intro(wt, "Feedback on this remote setup is fairly evenly split so far, without one clear pattern standing out yet.");
  intro(wt, "Remote reviews here are still a mixed bag.");
  conclusion(wt, "Overall, this is a genuinely flexible place to work remotely, as long as you stay comfortable setting your own limits.");
  conclusion(wt, "A flexible remote role, if you set your own limits.");

  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "AGREE", "Management trusts remote employees to do their jobs without resorting to tracking software or spyware.");
  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "DISAGREE", "Trust is thin enough here that tracking software or constant check-ins fill the gap.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 4, "AGREE", "Meetings and deadlines actually respect your local timezone instead of assuming everyone's on HQ time.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 4, "DISAGREE", "Calls and deadlines get scheduled with little regard for what time it actually is where you live.");

  qna(wt, "QNA_PRIMARY", "leadership", 1, "AGREE", "You're judged on what you actually deliver here, not on whether your status dot is green all day.");
  qna(wt, "QNA_PRIMARY", "leadership", 1, "DISAGREE", "Being \"away\" for twenty minutes gets noticed here more than what you actually got done.");
  qna(wt, "QNA_SECONDARY", "leadership", 4, "AGREE", "When someone's clearly burning out, leadership actually steps in instead of waiting for a resignation.");
  qna(wt, "QNA_SECONDARY", "leadership", 4, "DISAGREE", "Burnout can go on for months here before anyone in leadership says a word about it.");

  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "AGREE", "They actually provide a real stipend or solid hardware for your home setup, not just a login and a shrug.");
  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "DISAGREE", "You're mostly expected to make do with your own hardware and internet, with little help from the company.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "AGREE", "The VPN and cloud tools actually work reliably, without constant dropouts or lag.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "DISAGREE", "The VPN and internal tools are unreliable enough to eat into real work time most weeks.");

  qna(wt, "QNA_PRIMARY", "workLifeBalance", 3, "AGREE", "Once the workday ends here, it actually ends — there's a real, enforced right to disconnect.");
  qna(wt, "QNA_PRIMARY", "workLifeBalance", 3, "DISAGREE", "The workday technically ends, but the messages and expectations don't.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "AGREE", "The workload handed to you is realistic enough to fit inside an actual standard week.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "DISAGREE", "Getting everything done means regularly going well past a standard work week.");

  qna(wt, "QNA_PRIMARY", "stability", 2, "AGREE", "Remote staff here are paid the same as in-office peers doing the same job, no quiet pay cut for working from home.");
  qna(wt, "QNA_PRIMARY", "stability", 2, "DISAGREE", "Working remotely quietly comes with a lower rate than the same role done in-office.");
  qna(wt, "QNA_SECONDARY", "stability", 5, "AGREE", "There's little worry here that a remote role could just disappear or be shipped elsewhere without warning.");
  qna(wt, "QNA_SECONDARY", "stability", 5, "DISAGREE", "There's a real, ongoing worry that remote roles here could be cut or offshored with no notice.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Remote staff are trusted without tracking software and treated the same as office staff.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "Your time zone and your time to reply are respected, and remote socials really are optional.");
  flagRow(wt, "corporateCulture", 1, "RED", "Reviewers describe remote staff being monitored closely or passed over in favour of the office.");
  flagRow(wt, "corporateCulture", 2, "RED", "Reviewers describe pressure to answer instantly and to show up to events that are meant to be optional.");

  flagRow(wt, "leadership", 1, "GREEN", "Managers judge results, run focused meetings and answer when you need them.");
  flagRow(wt, "leadership", 2, "GREEN", "Leadership is honest in its updates and steps in when someone is burning out.");
  flagRow(wt, "leadership", 1, "RED", "Reviewers say online activity is watched more closely than the actual work.");
  flagRow(wt, "leadership", 2, "RED", "Reviewers say burnout goes unnoticed and leadership updates are not always straight.");

  flagRow(wt, "infrastructure", 1, "GREEN", "The company equips remote staff properly and IT sorts out access problems fast.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Remote tools, VPN access and documentation work the way they should.");
  flagRow(wt, "infrastructure", 1, "RED", "Reviewers say they are largely left to sort out their own equipment and access problems.");
  flagRow(wt, "infrastructure", 2, "RED", "Reviewers describe unreliable remote access and messy tools and documents.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "The workday really ends, without unpaid hours creeping in.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "The workload fits a normal week and office days have a reason behind them.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Reviewers report work regularly spilling into unpaid personal time.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Reviewers describe an unmanageable workload and office days that serve no purpose.");

  flagRow(wt, "stability", 1, "GREEN", "Remote staff get the same pay and the same chances to grow.");
  flagRow(wt, "stability", 2, "GREEN", "Remote work here feels settled, with clear goals and no talk of forced returns.");
  flagRow(wt, "stability", 1, "RED", "Reviewers say remote staff fall behind on pay, mentoring or promotions.");
  flagRow(wt, "stability", 2, "RED", "Reviewers describe repeated talk of forced office returns, or worry that remote roles could disappear.");
}

// ===================== SERVICE =====================
{
  const wt: WorkplaceType = "SERVICE";
  intro(wt, "Opinions on working the floor here are fairly evenly split, without one clear pattern standing out yet.");
  intro(wt, "Reviews from the floor here are still mixed.");
  conclusion(wt, "Overall, this is a fair place to work a floor job, provided you go in with realistic expectations about the pace.");
  conclusion(wt, "A fair floor job, if your expectations are realistic.");

  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "AGREE", "When a customer gets abusive, management actually backs the worker instead of the customer by default.");
  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "DISAGREE", "The customer gets the benefit of the doubt here even when they're clearly the one in the wrong.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 3, "AGREE", "Speed targets here are set at a pace you can actually hit without cutting corners on safety.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 3, "DISAGREE", "Hitting the speed targets here basically requires cutting corners that shouldn't be cut.");

  qna(wt, "QNA_PRIMARY", "leadership", 2, "AGREE", "When it gets slammed, managers actually jump in on the floor instead of just watching.");
  qna(wt, "QNA_PRIMARY", "leadership", 2, "DISAGREE", "During the busiest rushes, management tends to disappear instead of helping out.");
  qna(wt, "QNA_SECONDARY", "leadership", 1, "AGREE", "Shift scheduling here is handled fairly, without a clear circle of favorites getting the good slots.");
  qna(wt, "QNA_SECONDARY", "leadership", 1, "DISAGREE", "The same few people always seem to get the better shifts and the easier tasks.");

  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "AGREE", "The registers and POS systems actually hold up during a busy rush instead of freezing at the worst moment.");
  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "DISAGREE", "The POS system has a habit of crashing right when the line is out the door.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "AGREE", "The break area is actually clean and separate from customers, not just a back corner near the bins.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "DISAGREE", "The break area is cramped, dirty, and barely separate from the customer-facing floor.");

  qna(wt, "QNA_PRIMARY", "workLifeBalance", 1, "AGREE", "Schedules go up at least two weeks out, so planning your life around shifts is actually realistic.");
  qna(wt, "QNA_PRIMARY", "workLifeBalance", 1, "DISAGREE", "Schedules drop with so little notice that planning anything else around them is basically impossible.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "AGREE", "Extra shifts are genuinely optional here, not forced on you under threat of penalty.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "DISAGREE", "Turning down an extra shift here comes with a real risk of being penalized for it.");

  qna(wt, "QNA_PRIMARY", "stability", 1, "AGREE", "Pay, overtime and tips here are worked out openly and explained clearly.");
  qna(wt, "QNA_PRIMARY", "stability", 1, "DISAGREE", "Reviewers say it is not clear how pay, overtime and tips are calculated.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "AGREE", "Shifts are actually staffed properly here instead of running short week after week.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "DISAGREE", "This location is chronically understaffed, so every shift ends up stretched thin.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Management stands with staff against abusive customers, and the floor is supportive.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "Targets are realistic, shifts are shared out fairly and hard work gets noticed.");
  flagRow(wt, "corporateCulture", 1, "RED", "Reviewers say staff are left on their own with difficult customers.");
  flagRow(wt, "corporateCulture", 2, "RED", "Reviewers describe unrealistic targets and an unfair share-out of shifts.");

  flagRow(wt, "leadership", 1, "GREEN", "The same rules apply to everyone, with no favourites.");
  flagRow(wt, "leadership", 2, "GREEN", "Managers help out at rush hour and act quickly on complaints.");
  flagRow(wt, "leadership", 1, "RED", "Reviewers report supervisors favouring some staff with shifts and tasks.");
  flagRow(wt, "leadership", 2, "RED", "Reviewers say managers are hard to find when the floor needs them and slow to act on complaints.");

  flagRow(wt, "infrastructure", 1, "GREEN", "Tills and equipment hold up when it is busy, and stock is there when you need it.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Break areas are clean, safety rules are kept and breaks are actually given.");
  flagRow(wt, "infrastructure", 1, "RED", "Reviewers describe equipment failing at busy times and supplies running short.");
  flagRow(wt, "infrastructure", 2, "RED", "Reviewers report breaks being skipped or safety measures slipping.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Days off stay days off, overtime is voluntary and shifts leave time to rest.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Schedules come out well in advance and personal plans are respected.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Reviewers report pressure to work on days off, back-to-back closing and opening shifts, or overtime that is not really optional.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Reviewers say schedules come out late and change at short notice.");

  flagRow(wt, "stability", 1, "GREEN", "Pay, overtime and tips are worked out openly and paid correctly.");
  flagRow(wt, "stability", 2, "GREEN", "The team is stable and there is a real path up to supervisor.");
  flagRow(wt, "stability", 1, "RED", "Reviewers raise concerns about how pay, overtime or tips are calculated and paid.");
  flagRow(wt, "stability", 2, "RED", "Reviewers describe constant turnover and short-staffed shifts.");
}

// ===================== MANUAL_LABOUR =====================
{
  const wt: WorkplaceType = "MANUAL_LABOUR";
  intro(wt, "Opinions on this site are fairly evenly split, with roughly as many good reports as bad ones so far.");
  intro(wt, "Reviews from this site are still a mixed bag.");
  conclusion(wt, "While the pay is highly reliable and the safety equipment is modern, you must be prepared for a physically punishing daily pace on the floor.");
  conclusion(wt, "Reliable pay here, but the daily pace is physically demanding.");

  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "AGREE", "Safety genuinely comes before the schedule here, not just on paper.");
  qna(wt, "QNA_PRIMARY", "corporateCulture", 1, "DISAGREE", "Hitting the deadline matters more here than whether the job gets done safely.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 2, "AGREE", "The crew culture here is solid, with no hazing or harassment.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 2, "DISAGREE", "Reviewers report hazing or harassment on this site.");

  qna(wt, "QNA_PRIMARY", "leadership", 1, "AGREE", "The foremen here have actually done the job themselves, not just managed it from an office.");
  qna(wt, "QNA_PRIMARY", "leadership", 1, "DISAGREE", "Whoever's giving the orders clearly hasn't done this actual work themselves.");
  qna(wt, "QNA_SECONDARY", "leadership", 4, "AGREE", "Report a safety issue here and it actually gets fixed right away, not weeks later.");
  qna(wt, "QNA_SECONDARY", "leadership", 4, "DISAGREE", "Reported safety hazards can sit unfixed for a long time before anyone deals with them.");

  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "AGREE", "The machinery and tools here are properly maintained, not held together and hoped for the best.");
  qna(wt, "QNA_PRIMARY", "infrastructure", 1, "DISAGREE", "Equipment here is worn down enough that using it safely takes extra care nobody should have to add.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "AGREE", "The company also provides all required safety gear for free on your first day.");
  qna(wt, "QNA_SECONDARY", "infrastructure", 2, "DISAGREE", "Required safety gear isn't reliably provided — you're often left to sort it out yourself.");

  qna(wt, "QNA_PRIMARY", "workLifeBalance", 1, "AGREE", "Shift lengths here stay reasonable enough that exhaustion-driven accidents aren't a constant risk.");
  qna(wt, "QNA_PRIMARY", "workLifeBalance", 1, "DISAGREE", "However, workers report that the daily shift lengths are deeply exhausting.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "AGREE", "Travel time to a distant site actually gets paid here, not treated as free time.");
  qna(wt, "QNA_SECONDARY", "workLifeBalance", 4, "DISAGREE", "Time spent traveling to far-off sites often goes uncompensated.");

  qna(wt, "QNA_PRIMARY", "stability", 1, "AGREE", "Working at this facility means you will always receive your paycheck on time without chasing down management, providing real financial peace of mind.");
  qna(wt, "QNA_PRIMARY", "stability", 1, "DISAGREE", "Paychecks here are inconsistent enough — wrong amounts or late deposits — that you can't fully count on them.");
  qna(wt, "QNA_SECONDARY", "stability", 2, "AGREE", "The hours here stay steady and predictable through the year.");
  qna(wt, "QNA_SECONDARY", "stability", 2, "DISAGREE", "Hours here swing a lot through the year, which makes planning hard.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Safety comes before speed, and workers' rights and injured workers are respected.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "The crew treats people with respect and pulls together.");
  flagRow(wt, "corporateCulture", 1, "RED", "Reviewers report safety taking second place to speed, or injured workers not being treated fairly.");
  flagRow(wt, "corporateCulture", 2, "RED", "Reviewers report hazing or a hostile atmosphere on site.");

  flagRow(wt, "leadership", 1, "GREEN", "Foremen know the work first-hand and share the hard jobs fairly.");
  flagRow(wt, "leadership", 2, "GREEN", "Hazards get fixed as soon as they are reported, and managers follow the same rules.");
  flagRow(wt, "leadership", 1, "RED", "Reviewers question the foremen's experience, or how fairly the hardest jobs are shared.");
  flagRow(wt, "leadership", 2, "RED", "Reviewers say reported hazards and broken gear are left as they are.");

  flagRow(wt, "infrastructure", 1, "GREEN", "Protective gear, drinking water, toilets and first aid are all provided.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Machines are serviced and safe, and materials arrive on time.");
  flagRow(wt, "infrastructure", 1, "RED", "Reviewers report missing protective gear, or missing basics like water, toilets or first aid.");
  flagRow(wt, "infrastructure", 2, "RED", "Reviewers describe poorly maintained machines or materials arriving late.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Shifts are a humane length, with real breaks and time to recover.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Overtime is a choice and travel to distant sites is paid.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Reviewers describe exhausting shifts with too little rest in between.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Reviewers report overtime that cannot be refused, or travel time that is not paid.");

  flagRow(wt, "stability", 1, "GREEN", "Pay arrives in full and on time, and incidents are properly recorded.");
  flagRow(wt, "stability", 2, "GREEN", "Hours are steady year-round, training is paid for and the work feels sustainable.");
  flagRow(wt, "stability", 1, "RED", "Reviewers raise problems with pay, or with incident reports not being handled.");
  flagRow(wt, "stability", 2, "RED", "Reviewers describe unsteady hours and work they doubt they can keep up for long.");
}

async function main() {
  await prisma.summaryPattern.deleteMany({});
  await prisma.summaryPattern.createMany({
    data: rows.map((r) => ({ ...r, characterCount: r.textBlock.length })),
  });
  console.log(`Seeded ${rows.length} SummaryPattern rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

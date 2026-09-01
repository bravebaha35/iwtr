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

  flagRow(wt, "corporateCulture", 1, "GREEN", "Teammates here genuinely have each other's backs instead of competing against one another.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "Leadership's actions match the ethics they claim to stand for.");
  flagRow(wt, "corporateCulture", 1, "RED", "Backstabbing and credit-stealing are a real part of this team's culture.");
  flagRow(wt, "corporateCulture", 2, "RED", "Leadership's public values and their private decisions don't line up.");

  flagRow(wt, "leadership", 1, "GREEN", "Managers here own their mistakes instead of passing them down the chain.");
  flagRow(wt, "leadership", 2, "GREEN", "The feedback you get is specific enough to actually do something with.");
  flagRow(wt, "leadership", 1, "RED", "When leadership drops the ball, it's the people under them who take the blame.");
  flagRow(wt, "leadership", 2, "RED", "Management hovers over every small task instead of trusting people to do their jobs.");

  flagRow(wt, "infrastructure", 1, "GREEN", "The hardware and software people work with here are genuinely up to date.");
  flagRow(wt, "infrastructure", 2, "GREEN", "IT tickets get resolved quickly instead of sitting in a queue.");
  flagRow(wt, "infrastructure", 1, "RED", "Slow, outdated computers and software are a daily frustration here.");
  flagRow(wt, "infrastructure", 2, "RED", "Basic office equipment is left to break down instead of getting fixed or replaced.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "When overtime is actually needed, it gets paid properly.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Once the day ends, it's genuinely over — no lingering pressure to stay reachable.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Extra hours are expected here without any extra pay to go with them.");
  flagRow(wt, "workLifeBalance", 2, "RED", "You will frequently be contacted during your time off.");

  flagRow(wt, "stability", 1, "GREEN", "People tend to stick around here — job security is real, not just a talking point.");
  flagRow(wt, "stability", 2, "GREEN", "Promotions follow a path you can actually see coming, not just office politics.");
  flagRow(wt, "stability", 1, "RED", "People cycle through this team fast — turnover is hard to ignore.");
  flagRow(wt, "stability", 2, "RED", "Layoffs here tend to land suddenly, with little warning or clear reasoning.");
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

  flagRow(wt, "corporateCulture", 1, "GREEN", "Being trusted to just do the work, without anyone watching over your shoulder digitally, is real here.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "Your local timezone is treated as a real constraint, not an inconvenience to schedule around.");
  flagRow(wt, "corporateCulture", 1, "RED", "Surveillance-style tracking software is part of daily life working remotely here.");
  flagRow(wt, "corporateCulture", 2, "RED", "Whatever timezone you're actually in gets routinely ignored when things get scheduled.");

  flagRow(wt, "leadership", 1, "GREEN", "What actually gets shipped matters more here than how active your status icon looks.");
  flagRow(wt, "leadership", 2, "GREEN", "Leadership tends to notice and act on burnout before it becomes a resignation.");
  flagRow(wt, "leadership", 1, "RED", "How long your status shows \"active\" gets watched more closely than it should.");
  flagRow(wt, "leadership", 2, "RED", "Burnout can be obvious here and still go completely unaddressed by leadership.");

  flagRow(wt, "infrastructure", 1, "GREEN", "A real hardware stipend or company equipment makes working from home actually workable.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Cloud access and internal systems stay dependable, even under regular daily use.");
  flagRow(wt, "infrastructure", 1, "RED", "Using your own personal laptop and internet for work is basically expected here.");
  flagRow(wt, "infrastructure", 2, "RED", "Remote access to internal systems is flaky enough to regularly slow real work down.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Disconnecting after hours isn't just allowed here, it's actually the norm.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "The workload stays sized to fit an actual normal week, not a stretched-out one.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Work and personal time blur together often enough that unpaid extra hours become routine.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Mandatory in-office days get enforced here with no real work reason behind them.");

  flagRow(wt, "stability", 1, "GREEN", "Pay here doesn't quietly drop just because your address is different from HQ's.");
  flagRow(wt, "stability", 2, "GREEN", "The remote-work policy feels stable enough that you're not bracing for it to vanish.");
  flagRow(wt, "stability", 1, "RED", "Working remotely here comes with a real, if unofficial, pay penalty.");
  flagRow(wt, "stability", 2, "RED", "Return-to-office threats resurface often enough that remote work never feels fully secure.");
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

  qna(wt, "QNA_PRIMARY", "stability", 1, "AGREE", "Pay and tips here are recorded and paid out honestly, without the wage-theft problems some places have.");
  qna(wt, "QNA_PRIMARY", "stability", 1, "DISAGREE", "Wage theft, missing tips, or unrecorded hours are a real problem workers report here.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "AGREE", "Shifts are actually staffed properly here instead of running short week after week.");
  qna(wt, "QNA_SECONDARY", "stability", 3, "DISAGREE", "This location is chronically understaffed, so every shift ends up stretched thin.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Staff actually get defended when a customer crosses the line, not thrown under the bus.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "The pace expected on shift is demanding but genuinely realistic, not a race against physics.");
  flagRow(wt, "corporateCulture", 1, "RED", "The customer is treated as always right, even at the worker's expense.");
  flagRow(wt, "corporateCulture", 2, "RED", "Keeping up with the pace here means shortcuts that aren't really safe to take.");

  flagRow(wt, "leadership", 1, "GREEN", "Managers work the floor alongside everyone else when things get busy.");
  flagRow(wt, "leadership", 2, "GREEN", "Scheduling decisions here are made fairly, without an obvious inner circle.");
  flagRow(wt, "leadership", 1, "RED", "Management tends to vanish right when the floor needs help the most.");
  flagRow(wt, "leadership", 2, "RED", "Favoritism from supervisors is a real, ongoing frustration on this team.");

  flagRow(wt, "infrastructure", 1, "GREEN", "The equipment you rely on all shift actually works when you need it to.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Break areas are kept genuinely clean and livable, not an afterthought.");
  flagRow(wt, "infrastructure", 1, "RED", "POS and register crashes are a recurring, disruptive problem on shift.");
  flagRow(wt, "infrastructure", 2, "RED", "Break areas are left neglected, more storage closet than actual break room.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Getting your schedule with real advance notice is standard here, not the exception.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Nobody's forced into overtime here — it's genuinely your call.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Shift changes land with almost no notice often enough to make outside plans risky.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Closing late and opening early the next morning happens more than it should.");

  flagRow(wt, "stability", 1, "GREEN", "Wages and tips are calculated accurately, every pay period, without workers having to double-check.");
  flagRow(wt, "stability", 2, "GREEN", "Shifts here run properly staffed instead of everyone covering for missing coworkers.");
  flagRow(wt, "stability", 1, "RED", "Shorted tips or missing pay are a recurring complaint from people who've worked here.");
  flagRow(wt, "stability", 2, "RED", "Being short-staffed isn't the occasional bad day here, it's close to the norm.");
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
  qna(wt, "QNA_SECONDARY", "corporateCulture", 2, "AGREE", "The crew culture here is solid — no hazing or toxic \"prove yourself\" games.");
  qna(wt, "QNA_SECONDARY", "corporateCulture", 2, "DISAGREE", "There's a real hazing and toxic-machismo problem baked into how this crew treats new people.");

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
  qna(wt, "QNA_SECONDARY", "stability", 2, "AGREE", "Work here stays steady year-round instead of the chaotic hire-and-fire cycle some sites run.");
  qna(wt, "QNA_SECONDARY", "stability", 2, "DISAGREE", "Work here swings between overloaded and laid-off often enough to make planning your finances hard.");

  flagRow(wt, "corporateCulture", 1, "GREEN", "Safety is treated as the actual first priority on this site, not a slogan on a poster.");
  flagRow(wt, "corporateCulture", 2, "GREEN", "The culture on this crew is genuinely respectful, without the macho posturing some sites have.");
  flagRow(wt, "corporateCulture", 1, "RED", "Getting the job done fast is pushed here even when it means cutting safety corners.");
  flagRow(wt, "corporateCulture", 2, "RED", "Toxic machismo and hazing are a real part of the culture on this crew.");

  flagRow(wt, "leadership", 1, "GREEN", "Foremen here have real hands-on experience doing the actual work.");
  flagRow(wt, "leadership", 2, "GREEN", "Hazards get fixed immediately once someone flags them.");
  flagRow(wt, "leadership", 1, "RED", "Management here often lacks real hands-on experience with the work itself.");
  flagRow(wt, "leadership", 2, "RED", "Unsafe conditions get reported and then largely ignored.");

  flagRow(wt, "infrastructure", 1, "GREEN", "Heavy machinery on this site is kept in genuinely safe working order.");
  flagRow(wt, "infrastructure", 2, "GREEN", "Required PPE is issued free, no cost or hassle to the worker.");
  flagRow(wt, "infrastructure", 1, "RED", "Equipment on this site is unsafe often enough to be a real, ongoing concern.");
  flagRow(wt, "infrastructure", 2, "RED", "Required PPE isn't reliably provided, so workers end up covering the gap themselves.");

  flagRow(wt, "workLifeBalance", 1, "GREEN", "Rest and water breaks are actually enforced here, not just technically allowed.");
  flagRow(wt, "workLifeBalance", 2, "GREEN", "Shift lengths are kept to a duration that doesn't wreck your body over time.");
  flagRow(wt, "workLifeBalance", 1, "RED", "Management enforces speed over physical recovery, often denying mandatory rest breaks and water when the production line is busy.");
  flagRow(wt, "workLifeBalance", 2, "RED", "Shift lengths here run long enough that exhaustion becomes a routine, expected part of the job.");

  flagRow(wt, "stability", 1, "GREEN", "Hazard pay is calculated accurately here, matching what workers are actually owed.");
  flagRow(wt, "stability", 2, "GREEN", "Work stays steady year-round instead of swinging between overloaded and slow.");
  flagRow(wt, "stability", 1, "RED", "Hazard pay is missing or shorted often enough to be a real complaint.");
  flagRow(wt, "stability", 2, "RED", "Hiring and firing here happens in unpredictable waves that make steady income hard to count on.");
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

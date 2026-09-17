// Hand-curated professional skills for the member CV "Skills" picker — NOT
// scraped from LinkedIn (declined per product decision, 2026-09-17: this
// codebase doesn't scrape third-party sites for content it displays as its
// own). Mix of software/technical, trade, language, and soft skills so
// every WorkplaceType has enough real choices. Delete-all + re-insert on
// every run, same convention as seed-sectors.ts.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-skills.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKILLS: string[] = [
  // Software & IT
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "SQL", "React", "Angular",
  "Vue.js", "Node.js", "Next.js", ".NET", "Spring Boot", "Django", "Docker", "Kubernetes", "AWS",
  "Azure", "Google Cloud Platform", "Git", "CI/CD", "DevOps", "Linux Administration", "Cybersecurity",
  "Network Administration", "Database Administration", "Data Analysis", "Data Engineering",
  "Machine Learning", "QA / Software Testing", "UI/UX Design", "Product Management", "Agile / Scrum",
  "API Design", "Mobile Development (iOS)", "Mobile Development (Android)", "WordPress", "SAP",
  "Salesforce", "Microsoft Excel (Advanced)", "Microsoft Office Suite", "Power BI", "Tableau",
  // Finance & Accounting
  "Financial Analysis", "Bookkeeping", "Auditing", "Tax Preparation", "Budgeting & Forecasting",
  "Accounts Payable/Receivable", "SAP FI/CO", "Risk Management", "Investment Analysis", "Payroll",
  // Sales & Marketing
  "Sales", "B2B Sales", "Account Management", "Digital Marketing", "SEO", "SEM / Google Ads",
  "Social Media Management", "Content Writing", "Copywriting", "Email Marketing", "Brand Management",
  "Market Research", "Public Relations", "Negotiation", "Customer Relationship Management (CRM)",
  // HR & Admin
  "Recruitment", "Employee Onboarding", "Performance Management", "HR Policy", "Office Administration",
  "Scheduling", "Data Entry", "Executive Assistance", "Event Planning",
  // Legal
  "Contract Law", "Corporate Law", "Legal Research", "Compliance", "Intellectual Property",
  // Healthcare
  "Patient Care", "Nursing", "First Aid / CPR", "Medical Records Management", "Phlebotomy",
  "Pharmacy Operations", "Physiotherapy", "Dental Assisting",
  // Education
  "Curriculum Development", "Classroom Management", "Tutoring", "Public Speaking", "Training & Facilitation",
  // Hospitality & Food Service
  "Food Preparation", "Barista Skills", "Bartending", "Customer Service", "Restaurant Management",
  "Menu Planning", "Food Safety & Hygiene", "Housekeeping", "Front Desk / Reception",
  // Retail
  "Cash Handling", "Inventory Management", "Merchandising", "Point of Sale (POS) Systems", "Retail Sales",
  // Logistics & Manual Labour
  "Forklift Operation", "Warehouse Management", "Supply Chain Management", "Commercial Driving (E-Class)",
  "Delivery / Courier", "Heavy Equipment Operation", "Welding", "Electrical Wiring", "Plumbing",
  "Carpentry", "Masonry", "HVAC Installation & Repair", "CNC Machine Operation", "Quality Control (Manufacturing)",
  "Occupational Health & Safety", "Rigging & Crane Operation", "Automotive Repair", "Painting (Construction)",
  "Landscaping", "Agriculture / Farming",
  // Security
  "Security Guard Operations", "CCTV Monitoring", "Loss Prevention", "Emergency Response",
  // Languages
  "Turkish (Native)", "English (Fluent)", "German", "French", "Spanish", "Arabic", "Russian", "Italian",
  // Soft skills
  "Leadership", "Team Management", "Problem Solving", "Time Management", "Communication",
  "Conflict Resolution", "Adaptability", "Critical Thinking", "Project Management", "Multitasking",
  "Attention to Detail", "Creativity", "Decision Making", "Customer-Focused Mindset",
];

async function main() {
  await prisma.skill.deleteMany({});
  await prisma.skill.createMany({ data: SKILLS.map((name) => ({ name })), skipDuplicates: true });
  console.log(`Seeded ${new Set(SKILLS).size} unique skills (${SKILLS.length} listed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Hand-curated skills for the member profile's "Verified skills" search box
// (shown on the CV). NOT scraped from LinkedIn (declined per product
// decision, 2026-09-17: this codebase doesn't scrape third-party sites for
// content it displays as its own).
//
// 2026-10-12 revision:
// - Widened well beyond office work: Manual-Labour (trades, production,
//   construction, logistics, farming) and Service (food, hotels, retail,
//   care, beauty, driving) now have as many real choices as Office and
//   Hybrid/Remote.
// - Added what the 2025-2026 skills reports keep naming: AI literacy and
//   generative-AI skills, data and cybersecurity, sustainability, and on
//   the trades side solar, EV charging, heat pumps, robotics and industrial
//   automation (sources read: LinkedIn "Skills on the Rise 2026" coverage,
//   WEF "Future of Jobs 2025" summaries, 2026 skilled-trades demand
//   round-ups). The names below are our own wording.
// - Languages are no longer skills. They moved to their own profile field
//   (User.languages, shared-types LANGUAGES); a member who had picked a
//   language skill gets that language on their profile instead (see
//   LANGUAGE_SKILL_CODES below).
//
// Safe to re-run: adds what's missing, keeps every skill a member already
// picked, and only removes the retired language skills.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-skills.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Retired language skills -> the language code that replaces them.
const LANGUAGE_SKILL_CODES: Record<string, string> = {
  "Turkish (Native)": "tr",
  "English (Fluent)": "en",
  German: "de",
  French: "fr",
  Spanish: "es",
  Arabic: "ar",
  Russian: "ru",
  Italian: "it",
};

const SKILLS: string[] = [
  // Software & IT
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "PHP", "SQL", "React", "Angular",
  "Vue.js", "Node.js", "Next.js", ".NET", "Spring Boot", "Django", "Docker", "Kubernetes", "AWS",
  "Azure", "Google Cloud Platform", "Git", "CI/CD", "DevOps", "Linux Administration", "Cybersecurity",
  "Network Administration", "Database Administration", "Data Analysis", "Data Engineering",
  "Machine Learning", "QA / Software Testing", "UI/UX Design", "Product Management", "Agile / Scrum",
  "API Design", "Mobile Development (iOS)", "Mobile Development (Android)", "WordPress", "SAP",
  "Salesforce", "Microsoft Excel (Advanced)", "Microsoft Office Suite", "Power BI", "Tableau",
  "Cloud Architecture", "IT Help Desk & Support", "Low-Code / No-Code Tools", "Technical Writing",
  // AI, data & automation (2026)
  "AI Literacy", "Generative AI Tools", "Prompt Engineering", "AI Agents & Workflow Automation",
  "Large Language Models (LLMs)", "MLOps", "Data Literacy", "Data Visualization", "Business Intelligence",
  "Robotic Process Automation (RPA)", "Information Security Awareness", "Data Privacy (KVKK / GDPR)",
  // Design & media
  "Graphic Design", "Figma", "Adobe Photoshop", "Adobe Illustrator", "Video Editing", "Photography",
  "Motion Graphics", "3D Modelling", "AutoCAD", "SolidWorks", "Revit / BIM", "Interior Design",
  // Finance & Accounting
  "Financial Analysis", "Bookkeeping", "Auditing", "Tax Preparation", "Budgeting & Forecasting",
  "Accounts Payable/Receivable", "SAP FI/CO", "Risk Management", "Investment Analysis", "Payroll",
  "ERP Systems (Logo / Netsis / Mikro)", "e-Invoice & e-Ledger", "Cost Accounting", "Credit Analysis",
  "Banking Operations", "Insurance Sales & Claims",
  // Sales & Marketing
  "Sales", "B2B Sales", "Account Management", "Digital Marketing", "SEO", "SEM / Google Ads",
  "Social Media Management", "Content Writing", "Copywriting", "Email Marketing", "Brand Management",
  "Market Research", "Public Relations", "Negotiation", "Customer Relationship Management (CRM)",
  "Performance Marketing", "E-Commerce Management", "Online Marketplace Management", "Telesales",
  "Field Sales", "Export & Foreign Trade", "Customs Procedures", "Purchasing & Procurement",
  // HR & Admin
  "Recruitment", "Employee Onboarding", "Performance Management", "HR Policy", "Office Administration",
  "Scheduling", "Data Entry", "Executive Assistance", "Event Planning", "Labour Law (Turkey)",
  "Training & Development", "Remote Team Collaboration", "Archiving & Document Management",
  // Legal
  "Contract Law", "Corporate Law", "Legal Research", "Compliance", "Intellectual Property",
  // Sustainability
  "ESG & Sustainability Reporting", "Energy Efficiency", "Waste Management & Recycling",
  "Environmental Regulations",
  // Healthcare
  "Patient Care", "Nursing", "First Aid / CPR", "Medical Records Management", "Phlebotomy",
  "Pharmacy Operations", "Physiotherapy", "Dental Assisting", "Emergency Medical Technician",
  "Medical Laboratory Work", "Radiology Technician", "Sterilisation & Infection Control",
  "Medical Secretary",
  // Education
  "Curriculum Development", "Classroom Management", "Tutoring", "Public Speaking", "Training & Facilitation",
  "Early Childhood Education", "Special Education", "Online Teaching",
  // Hospitality & Food Service
  "Food Preparation", "Barista Skills", "Bartending", "Customer Service", "Restaurant Management",
  "Menu Planning", "Food Safety & Hygiene", "Housekeeping", "Front Desk / Reception",
  "Table Service (Waiting)", "Fine Dining Service", "Line Cooking", "Grill Station", "Pastry & Bakery",
  "Turkish Cuisine", "Dishwashing & Kitchen Stewarding", "Banquet & Catering Service",
  "Digital Ordering & Delivery Apps", "Hotel Reservation Systems (PMS)", "Guest Relations", "Concierge",
  "Tour Guiding", "Animation & Entertainment (Hotels)", "Laundry & Ironing",
  // Retail
  "Cash Handling", "Inventory Management", "Merchandising", "Point of Sale (POS) Systems", "Retail Sales",
  "Shelf Stocking", "Visual Merchandising", "Store Opening & Closing", "Upselling & Cross-Selling",
  "Returns & Exchanges", "Store Management", "Fuel Station Service",
  // Customer contact
  "Call Center Operations", "Live Chat Support", "Complaint Handling", "De-escalation",
  // Personal care & home services
  "Hairdressing", "Barbering", "Skin Care & Beauty", "Manicure & Pedicure", "Make-up Artistry",
  "Massage Therapy", "Fitness Instruction", "Lifeguarding", "Childcare", "Elderly Care",
  "Patient Companion Care", "Home Cleaning", "Office & Building Cleaning", "Pet Care & Grooming",
  "Tailoring & Alterations",
  // Driving & delivery
  "Commercial Driving (E-Class)", "Truck Driving (C / CE Class)", "Bus & Shuttle Driving",
  "Delivery / Courier", "Motorcycle Courier", "Taxi & Ride-Hailing Driving", "Valet & Parking",
  "SRC & Psychotechnical Certified", "ADR Hazardous Goods Transport", "Route Planning",
  // Logistics & warehouse
  "Forklift Operation", "Reach Truck & Pallet Jack Operation", "Warehouse Management",
  "Supply Chain Management", "Order Picking & Handheld Terminals", "Loading & Unloading",
  "Packaging & Labelling", "Cold Chain Handling", "Stock Counting", "Dispatch & Shipping",
  // Construction
  "Masonry", "Carpentry", "Plumbing", "Electrical Wiring", "Painting (Construction)",
  "Formwork & Rebar Work", "Concrete Work", "Tiling & Flooring", "Plastering & Drywall", "Roofing",
  "Insulation", "Scaffolding", "Heavy Equipment Operation", "Excavator Operation",
  "Rigging & Crane Operation", "Tower Crane Operation", "Site Supervision", "Surveying",
  "Working at Height", "Road & Asphalt Work",
  // Production & manufacturing
  "Welding", "TIG / MIG Welding", "CNC Machine Operation", "Lathe & Milling", "Sheet Metal Work",
  "Injection Moulding", "Production Line Operation", "Assembly", "Quality Control (Manufacturing)",
  "Lean Manufacturing / 5S", "Textile Machine Operation", "Sewing Machine Operation",
  "Cutting & Pattern Making", "Furniture Making & Upholstery", "Food Production & Processing",
  "Printing & Press Operation", "Glass & Ceramics Production", "Foundry & Casting",
  "Machine Safety (Lockout / Tagout)", "Shift Supervision",
  // Maintenance, energy & automation (2026)
  "HVAC Installation & Repair", "Mechanical Maintenance", "Electrical Maintenance",
  "Industrial Automation", "PLC Programming", "Industrial Robot Operation & Maintenance",
  "Hydraulics & Pneumatics", "Solar Panel (PV) Installation", "EV Charging Station Installation",
  "Heat Pump Installation", "Wind Turbine Maintenance", "Natural Gas Installation",
  "Elevator Installation & Maintenance", "Fire Safety Systems", "Electrical Panel Assembly",
  "Generator & UPS Maintenance", "Data Center Operations", "Fibre Optic & Telecom Cabling",
  // Automotive
  "Automotive Repair", "Electric & Hybrid Vehicle Repair", "Auto Body & Paint", "Auto Electrics",
  "Tyre & Brake Service", "Vehicle Diagnostics",
  // Agriculture & outdoors
  "Agriculture / Farming", "Landscaping", "Greenhouse Work", "Harvesting", "Tractor Operation",
  "Livestock Care", "Irrigation Systems", "Beekeeping", "Forestry Work", "Fishing & Aquaculture",
  // Other heavy industry
  "Mining Operations", "Shipbuilding & Marine Work", "Industrial Cleaning",
  // Safety & security
  "Occupational Health & Safety", "Security Guard Operations", "CCTV Monitoring", "Loss Prevention",
  "Emergency Response", "Private Security (Licensed)", "Fire Fighting",
  // Soft skills
  "Leadership", "Team Management", "Problem Solving", "Time Management", "Communication",
  "Conflict Resolution", "Adaptability", "Critical Thinking", "Project Management", "Multitasking",
  "Attention to Detail", "Creativity", "Decision Making", "Customer-Focused Mindset", "Teamwork",
  "Analytical Thinking", "Resilience", "Emotional Intelligence", "Stress Management",
  "Continuous Learning", "Reliability & Punctuality", "Shift Work Flexibility", "Mentoring",
];

async function retireLanguageSkills() {
  const retired = await prisma.skill.findMany({
    where: { name: { in: Object.keys(LANGUAGE_SKILL_CODES) } },
    include: { users: { select: { userId: true } } },
  });
  let moved = 0;
  for (const skill of retired) {
    const code = LANGUAGE_SKILL_CODES[skill.name];
    for (const { userId } of skill.users) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { languages: true } });
      if (user && !user.languages.includes(code)) {
        await prisma.user.update({ where: { id: userId }, data: { languages: [...user.languages, code] } });
        moved += 1;
      }
    }
    await prisma.userSkill.deleteMany({ where: { skillId: skill.id } });
    await prisma.skill.delete({ where: { id: skill.id } });
  }
  return { retired: retired.length, moved };
}

async function main() {
  const unique = [...new Set(SKILLS)];
  const { retired, moved } = await retireLanguageSkills();
  const { count } = await prisma.skill.createMany({ data: unique.map((name) => ({ name })), skipDuplicates: true });
  const total = await prisma.skill.count();
  console.log(
    `Skills: ${count} added, ${total} in the table (${unique.length} in this list). ` +
      `Language skills retired: ${retired}; members moved to the Languages field: ${moved}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

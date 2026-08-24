import { existsSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/modules/companies/slugify.util";

const prisma = new PrismaClient();

async function main() {
  const email = "iworkedthere@hotmail.com";
  const companyName = "I Worked There";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No registered user found with email ${email}. Register the account first.`);
  }

  // Served straight from apps/api's own /uploads static route, same as a
  // real owner-uploaded logo — this file is just the site's own logo.svg
  // copied in ahead of time, not routed through the multipart upload
  // endpoint since there's no browser session driving this script.
  // apps/api/uploads/ is gitignored (same as every other owner-uploaded
  // logo), so the copy has to happen here on every run rather than being a
  // one-off file committed to the repo — otherwise a fresh clone would set
  // mainPhotoUrl to a file that was never actually created.
  const logoDir = join(__dirname, "..", "uploads", "company-logos");
  const logoDest = join(logoDir, "iworkedthere.svg");
  if (!existsSync(logoDest)) {
    mkdirSync(logoDir, { recursive: true });
    copyFileSync(join(__dirname, "..", "..", "web", "public", "logo.svg"), logoDest);
  }

  const API_ORIGIN = process.env.API_PUBLIC_ORIGIN ?? "http://localhost:3001";
  const mainPhotoUrl = `${API_ORIGIN}/uploads/company-logos/iworkedthere.svg`;

  let company = await prisma.company.findFirst({
    where: { name: { equals: companyName, mode: "insensitive" } },
  });

  if (!company) {
    const baseSlug = slugify(companyName);
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.company.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
    company = await prisma.company.create({
      data: {
        slug,
        name: companyName,
        category: "OTHER",
        workplaceTypes: ["OFFICE"],
        createdByAdminId: user.id,
        mainPhotoUrl,
      },
    });
    console.log(`Created company "${company.name}" (slug: ${company.slug})`);
  } else {
    if (company.mainPhotoUrl !== mainPhotoUrl) {
      company = await prisma.company.update({ where: { id: company.id }, data: { mainPhotoUrl } });
    }
    console.log(`Company "${company.name}" already exists (slug: ${company.slug})`);
  }

  await prisma.$transaction([
    prisma.companyOwner.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      create: { userId: user.id, companyId: company.id, claimStatus: "APPROVED", resolvedAt: new Date() },
      update: { claimStatus: "APPROVED", resolvedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: user.id, role: "MEMBER" },
      data: { role: "COMPANY_OWNER" },
    }),
  ]);

  console.log(`Granted approved ownership of "${company.name}" to ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

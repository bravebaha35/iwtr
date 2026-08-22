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
      },
    });
    console.log(`Created company "${company.name}" (slug: ${company.slug})`);
  } else {
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

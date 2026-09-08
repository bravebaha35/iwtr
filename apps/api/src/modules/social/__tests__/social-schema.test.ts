import { PrismaClient } from "@prisma/client";

// Guards the model names later tasks depend on. Not a DB round-trip - just
// proves prisma generate ran and the delegates exist.
describe("social schema", () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it("exposes socialPost / socialComment / socialPostLike delegates", () => {
    expect(typeof prisma.socialPost.findMany).toBe("function");
    expect(typeof prisma.socialComment.findMany).toBe("function");
    expect(typeof prisma.socialPostLike.findMany).toBe("function");
  });
});

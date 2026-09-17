import { SkillsService } from "../skills.service";

describe("SkillsService", () => {
  it("listSkills returns all skills ordered by name", async () => {
    const prisma = {
      skill: { findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Python" }]) },
      sector: { findMany: jest.fn() },
    } as any;
    const service = new SkillsService(prisma);

    const result = await service.listSkills();

    expect(prisma.skill.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(result).toEqual([{ id: "1", name: "Python" }]);
  });

  it("listSectors returns all sectors ordered by label", async () => {
    const prisma = {
      skill: { findMany: jest.fn() },
      sector: {
        findMany: jest.fn().mockResolvedValue([{ id: "2", value: "IT", label: "Information Technology (IT)" }]),
      },
    } as any;
    const service = new SkillsService(prisma);

    const result = await service.listSectors();

    expect(prisma.sector.findMany).toHaveBeenCalledWith({ orderBy: { label: "asc" } });
    expect(result).toEqual([{ id: "2", value: "IT", label: "Information Technology (IT)" }]);
  });
});

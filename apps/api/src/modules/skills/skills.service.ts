import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  listSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: "asc" } });
  }

  listSectors() {
    return this.prisma.sector.findMany({ orderBy: { label: "asc" } });
  }
}

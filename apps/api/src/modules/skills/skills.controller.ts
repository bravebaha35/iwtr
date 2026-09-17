import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SkillsService } from "./skills.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get("skills")
  listSkills() {
    return this.skills.listSkills();
  }

  @Get("sectors")
  listSectors() {
    return this.skills.listSectors();
  }
}

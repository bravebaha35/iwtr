import { z } from "zod";
import { workplaceTypeSchema } from "./workplaceType";

// A row from the read-only Skill lookup table (apps/api/prisma/schema.prisma).
// Never free text — always referenced by id, see updateProfileInputSchema's
// skillIds field and ProfileService.updateProfile's existence check.
export const skillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type Skill = z.infer<typeof skillSchema>;

// A row from the read-only Sector lookup table. workplaceTypes travels with
// every row (not trimmed down to just id/value/label) because the Personal
// Information tab's own cascading filter (sectorAppliesTo, in
// apps/web/src/app/me/page.tsx) needs it client-side, the same way
// sectorsForWorkplaceTypes already filters the frontend-only SECTORS
// constant for the (separate, unrelated) company Sector/Industry picker.
// The backend's own check in ProfileService.updateProfile is the real
// enforcement — this is what lets the dropdown narrow itself before the
// member ever submits.
export const sectorSchema = z.object({
  id: z.string().uuid(),
  value: z.string(),
  label: z.string(),
  workplaceTypes: z.array(workplaceTypeSchema),
});
export type Sector = z.infer<typeof sectorSchema>;

// Same cap as the profile's skillIds — mirrored here so GET /sectors and
// GET /skills response-shape assertions (if ever added) share one source.
export const MAX_SKILLS_PER_MEMBER = 10;

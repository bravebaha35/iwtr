import { jobPositionSchema, type JobPosition } from "@iwtr/shared-types";

// Display labels for a job posting's Position (Post a job, the Jobs page's
// Position filter, the full job card). Kept here, not in shared-types, so
// rewording is a one-file change - same split as workplaceTypes.ts. The set
// of values and their order come from jobPositionSchema.
const JOB_POSITION_LABELS: Record<JobPosition, string> = {
  SENIOR_EXECUTIVE: "Senior executive",
  MIDDLE_MANAGER: "Middle-level manager",
  MANAGEMENT_TRAINEE: "Management trainee",
  SPECIALIST: "Specialist",
  ENTRY_LEVEL: "Entry-level / Beginner",
  FREELANCER: "Freelancer",
  BLUE_COLLAR: "Worker / Blue-collar worker",
  INTERN: "Intern",
  ASSISTANT_SPECIALIST: "Assistant specialist",
  STAFF_MEMBER: "Staff member",
  SERVICE_STAFF: "Service staff",
};

export const JOB_POSITIONS: { value: JobPosition; label: string }[] = jobPositionSchema.options.map((value) => ({
  value,
  label: JOB_POSITION_LABELS[value],
}));

export function jobPositionLabel(value: JobPosition): string {
  return JOB_POSITION_LABELS[value];
}

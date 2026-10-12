import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobPosition } from "@iwtr/shared-types";
import { PositionPicker } from "../PositionPicker";

function Harness({ max }: { max?: number }) {
  const [selected, setSelected] = useState<JobPosition[]>([]);
  return (
    <PositionPicker
      max={max}
      selected={selected}
      onToggle={(v) => setSelected((prev) => (prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]))}
    />
  );
}

const box = (name: string) => screen.getByRole("checkbox", { name });

it("lists the eleven positions in their fixed order", () => {
  render(<Harness />);
  expect(screen.getAllByRole("checkbox").map((b) => b.textContent)).toEqual([
    "Senior executive",
    "Middle-level manager",
    "Management trainee",
    "Specialist",
    "Entry-level / Beginner",
    "Freelancer",
    "Worker / Blue-collar worker",
    "Intern",
    "Assistant specialist",
    "Staff member",
    "Service staff",
  ]);
});

it("with a limit of 3, the rest lock until one is unticked", async () => {
  const user = userEvent.setup();
  render(<Harness max={3} />);
  await user.click(box("Specialist"));
  await user.click(box("Intern"));
  await user.click(box("Freelancer"));
  expect(box("Specialist")).toBeChecked();
  expect(box("Staff member")).toBeDisabled();
  await user.click(box("Intern"));
  expect(box("Intern")).not.toBeChecked();
  expect(box("Staff member")).toBeEnabled();
});

it("has no limit in the filter sidebar", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  for (const name of ["Specialist", "Intern", "Freelancer", "Staff member"]) await user.click(box(name));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(4);
});

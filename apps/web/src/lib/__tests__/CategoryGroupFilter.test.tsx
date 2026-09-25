import { fireEvent, render, screen } from "@testing-library/react";
import { CATEGORY_GROUP_BUTTONS, CategoryGroupFilter } from "../categoryGroups";

it("always shows all 7 job-type groups with their names — no open/close button", () => {
  render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  expect(screen.queryByRole("button", { name: /quick select/i })).not.toBeInTheDocument();
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(7);
  expect(radios.map((r) => r.textContent)).toEqual(CATEGORY_GROUP_BUTTONS.map((b) => b.label));
});

it("lays out as a horizontal row by default and a vertical list when asked", () => {
  const { rerender } = render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  const group = () => screen.getByRole("radiogroup");
  expect(group()).toHaveAttribute("aria-orientation", "horizontal");
  expect(group()).toHaveClass("flex-row");

  rerender(<CategoryGroupFilter value={null} onChange={() => {}} orientation="vertical" />);
  expect(group()).toHaveAttribute("aria-orientation", "vertical");
  expect(group()).toHaveClass("flex-col");
});

it("picks a group, and picking it again clears it", () => {
  const onChange = jest.fn();
  const { rerender } = render(<CategoryGroupFilter value={null} onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: "Logistics" }));
  expect(onChange).toHaveBeenLastCalledWith("LOGISTICS");
  rerender(<CategoryGroupFilter value="LOGISTICS" onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: "Logistics" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("marks the picked group with the site's one selection colour", () => {
  render(<CategoryGroupFilter value="LOGISTICS" onChange={() => {}} />);
  const picked = screen.getByRole("radio", { name: "Logistics" });
  expect(picked).toHaveAttribute("aria-checked", "true");
  expect(picked).toHaveClass("bg-brand-600", "text-white");
  expect(screen.getByRole("radio", { name: "Firms" })).not.toHaveClass("bg-brand-600");
});

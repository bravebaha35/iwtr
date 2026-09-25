import { fireEvent, render, screen } from "@testing-library/react";
import { CATEGORY_GROUP_BUTTONS, CategoryGroupFilter } from "../categoryGroups";

const toggle = () => screen.getByRole("button", { name: /quick select/i });

it("starts as a single up-arrow button with nothing next to it", () => {
  render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  expect(screen.getAllByRole("button")).toEqual([toggle()]);
  expect(toggle()).toHaveAttribute("aria-expanded", "false");
  expect(toggle()).toHaveAttribute("data-arrow", "up");
  expect(toggle()).toHaveTextContent(/^$/);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it("opens into all 7 job-type groups at once, with the arrow turned right", () => {
  render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("aria-expanded", "true");
  expect(toggle()).toHaveAttribute("data-arrow", "right");
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(7);
  expect(radios.map((r) => r.textContent)).toEqual(CATEGORY_GROUP_BUTTONS.map((b) => b.label));
});

it("closes again on a second click", () => {
  render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  fireEvent.click(toggle());
  fireEvent.click(toggle());
  expect(toggle()).toHaveAttribute("data-arrow", "up");
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it("picks a group, and picking it again clears it", () => {
  const onChange = jest.fn();
  const { rerender } = render(<CategoryGroupFilter value={null} onChange={onChange} />);
  fireEvent.click(toggle());
  fireEvent.click(screen.getByRole("radio", { name: "Logistics" }));
  expect(onChange).toHaveBeenLastCalledWith("LOGISTICS");
  rerender(<CategoryGroupFilter value="LOGISTICS" onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: "Logistics" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("says which group is active even while collapsed", () => {
  render(<CategoryGroupFilter value="LOGISTICS" onChange={() => {}} />);
  expect(toggle()).toHaveAccessibleName("Open quick select (Logistics selected)");
});

import { fireEvent, render, screen } from "@testing-library/react";
import { CategoryGroupFilter } from "../categoryGroups";

it("puts an expand button first that shows names and hides them again", () => {
  render(<CategoryGroupFilter value={null} onChange={() => {}} />);
  const buttons = screen.getAllByRole("button");
  const toggle = screen.getByRole("button", { name: "Show category names" });
  expect(buttons[0]).toBe(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  // Collapsed: icon-only buttons (the name is only in the hover tooltip).
  expect(screen.getByRole("radio", { name: "Supermarket" })).toHaveTextContent(/^$/);

  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Show icons only" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("radio", { name: "Supermarket" })).toHaveTextContent("Supermarket");
  expect(screen.getByRole("radio", { name: "Oil & Energy" })).toHaveTextContent("Oil & Energy");

  fireEvent.click(screen.getByRole("button", { name: "Show icons only" }));
  expect(screen.getByRole("radio", { name: "Supermarket" })).toHaveTextContent(/^$/);
});

it("still picks a category from the extended list", () => {
  const onChange = jest.fn();
  render(<CategoryGroupFilter value={null} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Show category names" }));
  fireEvent.click(screen.getByRole("radio", { name: "Logistics" }));
  expect(onChange).toHaveBeenCalledWith("LOGISTICS");
});

import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsNav } from "../SettingsNav";

const items = [
  { key: "a" as const, label: "Alpha" },
  { key: "b" as const, label: "Beta" },
  { key: "jobs", label: "Jobs", href: "/jobs-page" },
];

it("renders its own <aside> holding a labelled nav, marks the active item, and switches on click", () => {
  const onChange = jest.fn();
  render(<SettingsNav label="Sections" items={items} active="a" onChange={onChange} />);

  const nav = screen.getByRole("navigation", { name: "Sections" });
  expect(nav.closest("aside")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Beta" })).not.toHaveAttribute("aria-current");

  fireEvent.click(screen.getByRole("button", { name: "Beta" }));
  expect(onChange).toHaveBeenCalledWith("b");
});

it("renders an href item as a real link, not a tab button", () => {
  render(<SettingsNav label="Sections" items={items} active="a" onChange={() => {}} />);
  expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/jobs-page");
  expect(screen.queryByRole("button", { name: "Jobs" })).toBeNull();
});

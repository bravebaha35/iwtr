import { render, screen, within } from "@testing-library/react";
import { OwnerDashboardSidePanel } from "../OwnerDashboardSidePanel";

const sections = () =>
  within(screen.getByRole("navigation", { name: "Company dashboard sections" }))
    .getAllByRole("button")
    .map((b) => b.textContent);

it("the owner sees the Company Login section", () => {
  render(<OwnerDashboardSidePanel active="general-info" onChange={jest.fn()} />);
  expect(sections()).toContain("Company Login");
});

it("someone signed in with the company login doesn't (they can't change it)", () => {
  render(<OwnerDashboardSidePanel active="general-info" onChange={jest.fn()} isCompanyLogin />);
  expect(sections()).not.toContain("Company Login");
  // It sees everything else about the company, Questions and Post Scheduling included (read-only).
  expect(sections()).toEqual(expect.arrayContaining(["Post Scheduling", "Job Postings"]));
});

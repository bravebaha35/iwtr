import { render, screen } from "@testing-library/react";
import { SidebarShell, SidebarContentRow } from "../SidebarShell";

it("SidebarShell renders an aside with the locked width/gap classes", () => {
  render(<SidebarShell><p>content</p></SidebarShell>);
  const aside = screen.getByText("content").closest("aside");
  expect(aside).not.toBeNull();
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

it("SidebarContentRow renders a row div with the locked flex classes", () => {
  render(<SidebarContentRow><p>content</p></SidebarContentRow>);
  const row = screen.getByText("content").parentElement;
  expect(row?.className).toBe("flex flex-col gap-6 sm:flex-row");
});

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortButtons, nextAlphaSort, sortCompaniesBy, type SortOption } from "../SortButtons";

function Harness() {
  const [sort, setSort] = useState<SortOption>("default");
  return (
    <>
      <SortButtons value={sort} onChange={setSort} />
      <output>{sort}</output>
    </>
  );
}

describe("A-Z sort button", () => {
  it("loops A→Z, Z→A, then back to the default order", () => {
    expect(nextAlphaSort("default")).toBe("alphabetical");
    expect(nextAlphaSort("alphabetical")).toBe("alphabeticalDesc");
    expect(nextAlphaSort("alphabeticalDesc")).toBe("default");
    expect(nextAlphaSort("ratingDesc")).toBe("alphabetical");
  });

  it("lights up on A-Z, stays lit and shows Z-A, then turns off", async () => {
    render(<Harness />);
    const button = () => screen.getByRole("button", { name: /A-Z|Z-A/ });
    expect(button()).toHaveAttribute("aria-pressed", "false");
    expect(button()).toHaveTextContent("A-Z");

    await userEvent.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    expect(button()).toHaveTextContent("A-Z");
    expect(screen.getByText("alphabetical", { selector: "output" })).toBeInTheDocument();

    await userEvent.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    expect(button()).toHaveTextContent("Z-A");
    expect(screen.getByText("alphabeticalDesc", { selector: "output" })).toBeInTheDocument();

    await userEvent.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "false");
    expect(button()).toHaveTextContent("A-Z");
    expect(screen.getByText("default", { selector: "output" })).toBeInTheDocument();
  });

  it("renders each sort as its own separate button", () => {
    render(<Harness />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["A-Z", "Workplace", "Rating"]);
    // No shared segmented track wrapping them.
    for (const b of buttons) expect(b.parentElement?.getAttribute("role")).toBe("group");
  });
});

describe("sortCompaniesBy", () => {
  const rows = [
    { name: "beta", overallAvg: 2, workplaceTypes: ["OFFICE" as const] },
    { name: "Çelik", overallAvg: null, workplaceTypes: ["SERVICE" as const] },
    { name: "alpha", overallAvg: 4, workplaceTypes: ["MANUAL_LABOUR" as const] },
  ];

  it("sorts A-Z and Z-A with Turkish letters in the right place", () => {
    expect(sortCompaniesBy(rows, "alphabetical").map((r) => r.name)).toEqual(["alpha", "beta", "Çelik"]);
    expect(sortCompaniesBy(rows, "alphabeticalDesc").map((r) => r.name)).toEqual(["Çelik", "beta", "alpha"]);
  });

  it("leaves the order untouched for the default sort", () => {
    expect(sortCompaniesBy(rows, "default")).toBe(rows);
  });
});

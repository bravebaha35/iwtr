import { render, screen } from "@testing-library/react";
import { CompanyLogo } from "../CompanyLogo";
import { Logo } from "../Logo";

// Logos keep the squarer corners they had before the rounder redesign
// tokens — a fixed radius, not the theme's rounded-lg/xl (1rem+), which
// turned a 36px logo into a near-circle.
describe("logo shape", () => {
  it("company logos keep small fixed corners at every size, photo or initial", () => {
    const { rerender } = render(<CompanyLogo name="Migros" mainPhotoUrl="/brand-mark.png" size="sm" />);
    expect(screen.getByAltText("Migros logo")).toHaveClass("rounded-[0.5rem]");
    rerender(<CompanyLogo name="Migros" mainPhotoUrl={null} size="md" />);
    expect(screen.getByText("M")).toHaveClass("rounded-[0.5rem]");
    rerender(<CompanyLogo name="Migros" mainPhotoUrl={null} size="lg" />);
    expect(screen.getByText("M")).toHaveClass("rounded-[0.75rem]");
  });

  it("the site logo in the header keeps small fixed corners too", () => {
    render(<Logo size="sm" />);
    expect(screen.getByAltText("I Worked There")).toHaveClass("rounded-[0.5rem]");
  });
});

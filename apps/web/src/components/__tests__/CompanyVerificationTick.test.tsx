import { render, screen } from "@testing-library/react";
import { CompanyVerificationTick } from "../CompanyVerificationTick";

describe("CompanyVerificationTick", () => {
  it("renders nothing for an unclaimed Free-tier company", () => {
    const { container } = render(<CompanyVerificationTick badgeTier="FREE" claimed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a muted check-mark for a claimed Free-tier company", () => {
    render(<CompanyVerificationTick badgeTier="FREE" claimed />);
    const mark = screen.getByRole("img", { name: /claimed by the employer/i });
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark).toHaveClass("text-muted-foreground");
  });

  it.each([
    ["BLUE", "Starter member", "text-blue-600"],
    ["BLUE_PLUS", "Pro member", "text-green-600"],
    ["ENTERPRISE", "Enterprise member", "text-amber-500"],
  ] as const)("shows a %s-coloured check-mark for the paid tier", (tier, label, colorClass) => {
    render(<CompanyVerificationTick badgeTier={tier} claimed={false} />);
    const mark = screen.getByRole("img", { name: label });
    expect(mark.tagName.toLowerCase()).toBe("svg");
    // one shared symbol, only the colour differs — and it strokes currentColor
    expect(mark).toHaveClass(colorClass);
    expect(mark).toHaveAttribute("stroke", "currentColor");
  });

  it("no longer references any uploaded badge image", () => {
    const { container } = render(<CompanyVerificationTick badgeTier="ENTERPRISE" claimed />);
    expect(container.querySelector("img")).toBeNull();
  });
});

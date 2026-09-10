import { render, screen } from "@testing-library/react";
import { CompanyVerificationTick } from "../CompanyVerificationTick";

describe("CompanyVerificationTick", () => {
  it("shows the coloured tier tick image for a paid tier", () => {
    render(<CompanyVerificationTick badgeTier="BLUE_PLUS" claimed={false} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("blue+ tick"));
  });

  it("shows a minimal colourless check-mark for a claimed Free-tier company", () => {
    render(<CompanyVerificationTick badgeTier="FREE" claimed />);
    const mark = screen.getByRole("img", { name: /claimed by the employer/i });
    // An inline SVG using currentColor — no baked-in colour, adapts to theme.
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark).toHaveClass("text-muted-foreground");
  });

  it("renders nothing for an unclaimed Free-tier company", () => {
    const { container } = render(<CompanyVerificationTick badgeTier="FREE" claimed={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

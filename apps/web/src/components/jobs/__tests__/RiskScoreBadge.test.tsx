import { render, screen } from "@testing-library/react";
import { RiskScoreBadge } from "../RiskScoreBadge";

describe("RiskScoreBadge, short form (job cards)", () => {
  it("reads 'RS 3/3' in the red severity colour, with no warning icons", () => {
    const { container } = render(<RiskScoreBadge riskScore={3} short />);
    const badge = screen.getByText("RS 3/3");
    expect(badge).toHaveClass("text-red-600");
    expect(screen.getByText("Risk Score 3 of 3")).toHaveClass("sr-only");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("keeps each score's own colour", () => {
    const { rerender } = render(<RiskScoreBadge riskScore={0} short />);
    expect(screen.getByText("RS 0/3")).toHaveClass("text-green-700");
    rerender(<RiskScoreBadge riskScore={1} short />);
    expect(screen.getByText("RS 1/3")).toHaveClass("text-amber-700");
    rerender(<RiskScoreBadge riskScore={2} short />);
    expect(screen.getByText("RS 2/3")).toHaveClass("text-orange-700");
  });

  it("shows 'RS -' when there's no real posting yet", () => {
    render(<RiskScoreBadge riskScore={null} short />);
    expect(screen.getByText("RS -")).toBeInTheDocument();
    expect(screen.getByText("Risk Score not available yet")).toHaveClass("sr-only");
  });
});

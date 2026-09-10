import { render, screen } from "@testing-library/react";
import { WorkTypeLabel } from "../WorkTypeLabel";

describe("WorkTypeLabel", () => {
  it("renders the primary work-type in a bold weight", () => {
    render(<WorkTypeLabel workplaceTypes={["OFFICE"]} />);
    const primary = screen.getByText("Office");
    expect(primary).toHaveClass("font-bold");
  });

  it("renders the secondary work-type in a normal weight after a slash", () => {
    render(<WorkTypeLabel workplaceTypes={["SERVICE", "OFFICE"]} />);
    expect(screen.getByText("Service")).toHaveClass("font-bold");
    expect(screen.getByText("Office")).toHaveClass("font-normal");
    expect(screen.getByText(/\//)).toBeInTheDocument();
  });

  it("shows nothing for a secondary when the company has only one work-type", () => {
    const { container } = render(<WorkTypeLabel workplaceTypes={["MANUAL_LABOUR"]} />);
    expect(screen.getByText("Manual-Labour")).toBeInTheDocument();
    expect(container.textContent).not.toContain("/");
  });
});

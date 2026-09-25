import { fireEvent, render, screen } from "@testing-library/react";
import { ContactButton } from "../JobCard";

describe("ContactButton (job card Mail/Call)", () => {
  it("shows only its icon — no visible 'Mail' text — but keeps a spoken name", () => {
    render(<ContactButton icon="mail" label="Mail" value="info@example.com" />);
    const button = screen.getByRole("button", { name: "Mail: info@example.com" });
    expect(button).toHaveTextContent(/^$/);
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("still reveals the address when pressed", () => {
    render(<ContactButton icon="phone" label="Call" value="+905551112233" />);
    fireEvent.click(screen.getByRole("button", { name: "Call: +905551112233" }));
    expect(screen.getByText("+905551112233")).toBeInTheDocument();
  });
});

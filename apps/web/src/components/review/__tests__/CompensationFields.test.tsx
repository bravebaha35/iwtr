import { fireEvent, render, screen } from "@testing-library/react";
import {
  CompensationFields,
  EMPTY_COMPENSATION,
  KVKK_BENCHMARK_CONSENT_TEXT,
  toCompensationBody,
} from "../CompensationFields";

it("starts with the consent box unticked and shows the KVKK text right under the salary field", () => {
  render(<CompensationFields value={EMPTY_COMPENSATION} onChange={() => {}} />);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  const consentText = screen.getByText(KVKK_BENCHMARK_CONSENT_TEXT);
  expect(consentText).toHaveClass("text-xs");
  expect(screen.getByText("₺")).toBeInTheDocument();
  expect(screen.getByLabelText("Monthly net salary")).toHaveAttribute("inputmode", "numeric");
});

it("toggles a benefit on and off", () => {
  const onChange = jest.fn();
  const { rerender } = render(<CompensationFields value={EMPTY_COMPENSATION} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Meal card" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_COMPENSATION, benefits: ["MEAL_CARD"] });

  rerender(<CompensationFields value={{ ...EMPTY_COMPENSATION, benefits: ["MEAL_CARD"] }} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Meal card" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Meal card" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_COMPENSATION, benefits: [] });
});

it("warns when something is filled in without consent", () => {
  render(<CompensationFields value={{ ...EMPTY_COMPENSATION, salary: "45000" }} onChange={() => {}} />);
  expect(screen.getByText(/Tick the consent box/)).toBeInTheDocument();
});

describe("toCompensationBody", () => {
  it("sends nothing without consent", () => {
    expect(toCompensationBody({ consent: false, salary: "45000", benefits: ["GYM"] })).toBeUndefined();
  });

  it("sends nothing when consent is ticked but both fields are empty", () => {
    expect(toCompensationBody({ consent: true, salary: "  ", benefits: [] })).toBeUndefined();
  });

  it("sends the consent flag with the answers", () => {
    expect(toCompensationBody({ consent: true, salary: " 45.000 ", benefits: ["GYM"] })).toEqual({
      hasConsentedToCommercialBenchmarking: true,
      monthlyNetSalary: "45.000",
      benefits: ["GYM"],
    });
  });
});

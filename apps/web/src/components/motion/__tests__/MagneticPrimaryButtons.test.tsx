import { render } from "@testing-library/react";
import { MagneticPrimaryButtons } from "../MagneticPrimaryButtons";

function mockMatchMedia(matches: Record<string, boolean>) {
  window.matchMedia = ((query: string) => ({ matches: matches[query] ?? false })) as unknown as typeof window.matchMedia;
}

// jsdom has no PointerEvent constructor, so fireEvent.pointerMove would drop
// clientX/clientY — a MouseEvent carrying the pointermove type is
// indistinguishable to the listener, which only reads coordinates.
function pointerMove(el: Element, clientX: number, clientY: number) {
  el.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }));
}

function renderWithButtons() {
  const utils = render(
    <>
      <MagneticPrimaryButtons />
      <button type="button" className="bg-brand-600 text-white">
        Primary
      </button>
      <button type="button" className="border">
        Secondary
      </button>
    </>,
  );
  const primary = utils.getByText("Primary");
  primary.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
  return { ...utils, primary };
}

it("leans a primary button toward a fine pointer and snaps it back when the pointer leaves", () => {
  mockMatchMedia({ "(pointer: fine)": true });
  const { primary, getByText } = renderWithButtons();

  pointerMove(primary, 100, 40);
  expect(primary.style.transform).toBe("translate(4.00px, 3.00px)");

  pointerMove(getByText("Secondary"), 300, 300);
  expect(primary.style.transform).toBe("");
  expect(getByText("Secondary").style.transform).toBe("");
});

it("stays still for people who ask for reduced motion", () => {
  mockMatchMedia({ "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true });
  const { primary } = renderWithButtons();

  pointerMove(primary, 100, 40);
  expect(primary.style.transform).toBe("");
});

it("pulls a data-magnetic card less than a button", () => {
  window.matchMedia = ((query: string) => ({ matches: query === "(pointer: fine)" })) as unknown as typeof window.matchMedia;
  const { getByTestId } = render(
    <>
      <MagneticPrimaryButtons />
      <div data-magnetic="card" data-testid="card">
        <span data-testid="inside">Job</span>
      </div>
    </>,
  );
  const card = getByTestId("card");
  card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
  pointerMove(getByTestId("inside"), 200, 100);
  expect(card.style.transform).toBe("translate(2.00px, 2.00px)");
});

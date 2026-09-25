import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsentBanner } from "../CookieConsentBanner";
import { AnalyticsLoader } from "../AnalyticsLoader";
import { resetConsentForTests } from "@/lib/consent";
import { setReviewFlowActive } from "@/lib/reviewFlow";

let mockPathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

const SRC = "https://analytics.example/script.js";
const scriptTag = () => document.querySelector(`script[data-iwtr-analytics]`);

beforeEach(() => {
  localStorage.clear();
  resetConsentForTests();
  setReviewFlowActive(false);
  mockPathname = "/";
  document.querySelectorAll("script[data-iwtr-analytics]").forEach((s) => s.remove());
});

describe("CookieConsentBanner", () => {
  it("asks until the visitor chooses, then remembers Accept", async () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole("region", { name: "Cookie consent" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument();
    expect(localStorage.getItem("iwtr:cookie-consent")).toBe("accepted");
  });

  it("remembers Decline", async () => {
    render(<CookieConsentBanner />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(localStorage.getItem("iwtr:cookie-consent")).toBe("declined");
    expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument();
  });

  it("links to the privacy policy", () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
  });
});

describe("AnalyticsLoader", () => {
  it("loads nothing before consent", () => {
    render(<AnalyticsLoader src={SRC} />);
    expect(scriptTag()).toBeNull();
  });

  it("loads on a public page after Accept", async () => {
    render(
      <>
        <CookieConsentBanner />
        <AnalyticsLoader src={SRC} />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(scriptTag()).toHaveAttribute("src", SRC);
  });

  it("stays off on private pages even with consent", () => {
    localStorage.setItem("iwtr:cookie-consent", "accepted");
    resetConsentForTests();
    mockPathname = "/me/reviews";
    render(<AnalyticsLoader src={SRC} />);
    expect(scriptTag()).toBeNull();
  });

  it("is torn down the moment the review form opens", () => {
    localStorage.setItem("iwtr:cookie-consent", "accepted");
    resetConsentForTests();
    mockPathname = "/companies/acme";
    render(<AnalyticsLoader src={SRC} />);
    expect(scriptTag()).not.toBeNull();
    act(() => setReviewFlowActive(true));
    expect(scriptTag()).toBeNull();
    expect((window as unknown as { __iwtrAnalyticsDisabled?: boolean }).__iwtrAnalyticsDisabled).toBe(true);
  });

  it("does nothing when no analytics provider is configured", () => {
    localStorage.setItem("iwtr:cookie-consent", "accepted");
    resetConsentForTests();
    render(<AnalyticsLoader src={undefined} />);
    expect(scriptTag()).toBeNull();
  });
});

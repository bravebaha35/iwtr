import { render, screen } from "@testing-library/react";
import NotFound from "../not-found";

// No request in a test: no language cookie, so the page is in English.
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

describe("404 page", () => {
  it("explains the page is missing and offers exactly one way back", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/page/i);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Return to Dashboard");
    expect(links[0]).toHaveAttribute("href", "/");
  });

  it("gives the mascot illustration alt text", async () => {
    render(await NotFound());
    expect(screen.getByRole("img")).toHaveAccessibleName(/beaver/i);
  });
});

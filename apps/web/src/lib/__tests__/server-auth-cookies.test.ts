/**
 * @jest-environment node
 */
import { accessCookieOptions, refreshCookieOptions } from "../server-auth";

it("keeps both session cookies away from scripts and from requests other sites start", () => {
  for (const options of [accessCookieOptions(900), refreshCookieOptions()]) {
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  }
});

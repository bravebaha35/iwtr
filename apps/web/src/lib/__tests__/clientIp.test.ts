/** @jest-environment node */
import { forwardedForHeaders, visitorIp } from "../clientIp";

const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("visitorIp", () => {
  it("takes the address the one proxy in front of us added (the rightmost)", () => {
    // The visitor typed "6.6.6.6" themselves; the host's proxy appended the real one.
    expect(visitorIp(h("6.6.6.6, 203.0.113.9"), 1)).toBe("203.0.113.9");
  });

  it("counts further left when there are more proxies in front", () => {
    expect(visitorIp(h("6.6.6.6, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
  });

  it("unwraps an IPv4 address reported in IPv6 form", () => {
    expect(visitorIp(h("::ffff:127.0.0.1"), 1)).toBe("127.0.0.1");
  });

  it("keeps a real IPv6 address", () => {
    expect(visitorIp(h("::1"), 1)).toBe("::1");
  });

  it("returns nothing when the header is missing (review traffic has it removed)", () => {
    expect(visitorIp(h(), 1)).toBeNull();
    expect(forwardedForHeaders(h())).toEqual({});
  });

  it("ignores anything that is not an address", () => {
    expect(visitorIp(h("not-an-ip"), 1)).toBeNull();
    expect(visitorIp(h("1.2.3.4, <script>"), 1)).toBeNull();
  });

  it("returns nothing when there are fewer entries than proxies", () => {
    expect(visitorIp(h("203.0.113.9"), 2)).toBeNull();
  });

  it("is passed on as X-Forwarded-For", () => {
    expect(forwardedForHeaders(h("203.0.113.9"))).toEqual({ "X-Forwarded-For": "203.0.113.9" });
  });
});

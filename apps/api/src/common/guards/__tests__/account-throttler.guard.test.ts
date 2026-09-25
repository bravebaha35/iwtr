import { throttleTrackerFor } from "../account-throttler.guard";

function bearerFor(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `Bearer ${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}

describe("throttleTrackerFor", () => {
  it("buckets a signed-in caller by account, not by IP", () => {
    expect(throttleTrackerFor({ headers: { authorization: bearerFor({ sub: "user-1" }) }, ip: "10.0.0.1" })).toBe(
      "account:user-1",
    );
  });

  it("gives two accounts behind the same proxy IP separate buckets", () => {
    const a = throttleTrackerFor({ headers: { authorization: bearerFor({ sub: "a" }) }, ip: "10.0.0.1" });
    const b = throttleTrackerFor({ headers: { authorization: bearerFor({ sub: "b" }) }, ip: "10.0.0.1" });
    expect(a).not.toBe(b);
  });

  it("falls back to the connection address when there's no usable token", () => {
    expect(throttleTrackerFor({ headers: {}, ip: "10.0.0.1" })).toBe("ip:10.0.0.1");
    expect(throttleTrackerFor({ headers: { authorization: "Bearer not-a-jwt" }, ip: "10.0.0.1" })).toBe("ip:10.0.0.1");
    expect(throttleTrackerFor({ headers: { authorization: bearerFor({ nope: 1 }) }, ip: "10.0.0.1" })).toBe(
      "ip:10.0.0.1",
    );
  });
});

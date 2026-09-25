import { formTrapHeaders } from "../formTrap";

describe("formTrapHeaders", () => {
  it("reports the hidden field's value and how long the form was open", () => {
    expect(formTrapHeaders({ openedAt: 1_000, trapValue: "", now: 31_000 })).toEqual({
      "x-form-trap": "",
      "x-form-age-ms": "30000",
    });
  });

  it("passes a bot-filled trap value through unchanged, for the proxy to reject", () => {
    expect(formTrapHeaders({ openedAt: 0, trapValue: "http://spam", now: 10 })["x-form-trap"]).toBe("http://spam");
  });

  it("never reports a negative age if the clock moved backwards", () => {
    expect(formTrapHeaders({ openedAt: 5_000, trapValue: "", now: 1_000 })["x-form-age-ms"]).toBe("0");
  });
});

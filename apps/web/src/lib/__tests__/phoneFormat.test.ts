import { formatGroupedDigits } from "../phoneFormat";

test("groups a full mobile number as 3-3-2-2", () => {
  expect(formatGroupedDigits("5551234567", [3, 3, 2, 2])).toBe("555-123-45-67");
});

test("groups a full landline local number as 3-2-2", () => {
  expect(formatGroupedDigits("1234567", [3, 2, 2])).toBe("123-45-67");
});

test("formats a partial, still-being-typed number without a trailing dash", () => {
  expect(formatGroupedDigits("55512", [3, 3, 2, 2])).toBe("555-12");
});

test("returns an empty string for no digits", () => {
  expect(formatGroupedDigits("", [3, 2, 2])).toBe("");
});

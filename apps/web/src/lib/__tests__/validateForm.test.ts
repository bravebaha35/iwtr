import { z } from "zod";
import { formProblem } from "../validateForm";

const schema = z.object({
  firstName: z.string().min(1),
  email: z.string().email(),
  message: z.string().max(5, { message: "Keep it short" }),
});

describe("formProblem", () => {
  it("is null when the form is valid", () => {
    expect(formProblem(schema, { firstName: "Ada", email: "a@b.co", message: "hi" })).toBeNull();
  });

  it("names the first field with a problem in plain words", () => {
    expect(formProblem(schema, { firstName: "", email: "a@b.co", message: "hi" })).toBe(
      "Please check your first name.",
    );
  });

  it("uses a schema's own custom message when it has one", () => {
    expect(formProblem(schema, { firstName: "Ada", email: "a@b.co", message: "far too long" })).toBe(
      "Keep it short.",
    );
  });

  it("can use friendlier field labels", () => {
    expect(formProblem(schema, { firstName: "Ada", email: "nope", message: "" }, { email: "email address" })).toBe(
      "Please check your email address.",
    );
  });
});

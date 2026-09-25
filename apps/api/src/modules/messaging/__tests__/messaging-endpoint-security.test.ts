import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { sendMessageInputSchema } from "@iwtr/shared-types";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { MessagingController } from "../messaging.controller";

// The exact pipe every message-writing route uses.
const pipe = new ZodValidationPipe(sendMessageInputSchema, { strict: true });
const asParsedJson = (body: unknown) => JSON.parse(JSON.stringify(body));

describe("messaging endpoints — payload hardening", () => {
  it("accepts a plain message", () => {
    expect(pipe.transform(asParsedJson({ content: "Hello" }))).toEqual({ content: "Hello" });
  });

  it.each([
    ["an unexpected field", { content: "Hello", side: "COMPANY" }],
    ["a client-chosen author", { content: "Hello", authorUserId: "someone" }],
    ["an empty message", { content: "   " }],
    ["an overlong message", { content: "x".repeat(2001) }],
    ["a non-string message", { content: ["a", "b"] }],
  ])("rejects %s", (_label, body) => {
    expect(() => pipe.transform(asParsedJson(body))).toThrow(BadRequestException);
  });

  it("requires a logged-in user on every route", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MessagingController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });
});

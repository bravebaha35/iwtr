import { NotFoundException } from "@nestjs/common";
import { PUBLIC_COMPANY_WHERE, assertCompanyVisibleOrThrow } from "../company-visibility";

describe("company visibility", () => {
  it("PUBLIC_COMPANY_WHERE filters to non-hidden", () => {
    expect(PUBLIC_COMPANY_WHERE).toEqual({ hiddenAt: null });
  });
  it("assertCompanyVisibleOrThrow throws on a missing company", () => {
    expect(() => assertCompanyVisibleOrThrow(null)).toThrow(NotFoundException);
  });
  it("assertCompanyVisibleOrThrow throws on a hidden company", () => {
    expect(() => assertCompanyVisibleOrThrow({ hiddenAt: new Date() })).toThrow(NotFoundException);
  });
  it("assertCompanyVisibleOrThrow passes a visible company", () => {
    expect(() => assertCompanyVisibleOrThrow({ hiddenAt: null })).not.toThrow();
  });
});

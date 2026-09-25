import { isOwnStaticAsset } from "../imageSource";

describe("isOwnStaticAsset", () => {
  it("is true for files in /public", () => {
    expect(isOwnStaticAsset("/office-default-banner.webp")).toBe(true);
  });
  it("is false for uploads and other hosts", () => {
    expect(isOwnStaticAsset("http://localhost:3001/uploads/logo.webp")).toBe(false);
    expect(isOwnStaticAsset("//cdn.example.com/x.png")).toBe(false);
    expect(isOwnStaticAsset("blob:http://localhost:3000/abc")).toBe(false);
  });
});

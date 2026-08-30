const createMock = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ messages: { create: createMock } })),
  };
});

import { NarrativeGeneratorService } from "../narrative-generator.service";

describe("NarrativeGeneratorService", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    createMock.mockReset();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("is unavailable when ANTHROPIC_API_KEY is unset", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(new NarrativeGeneratorService().available).toBe(false);
  });

  it("is available when the key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(new NarrativeGeneratorService().available).toBe(true);
  });

  it("generate() rejects when unavailable and never calls the SDK", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(new NarrativeGeneratorService().generate("hi")).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("generate() returns the concatenated text blocks, trimmed", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "This workplace " },
        { type: "text", text: "is steady.  " },
      ],
    });
    const out = await new NarrativeGeneratorService().generate("some user message");
    expect(out).toBe("This workplace is steady.");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
      expect.objectContaining({ timeout: 8000 }),
    );
  });

  it("generate() propagates an SDK error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    createMock.mockRejectedValue(new Error("overloaded"));
    await expect(new NarrativeGeneratorService().generate("x")).rejects.toThrow("overloaded");
  });
});

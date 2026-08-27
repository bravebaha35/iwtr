import { summarizeCommentThemes } from "../comment-theme-summary.util";

describe("summarizeCommentThemes", () => {
  it("never returns any of the raw comment text, only theme counts", () => {
    const comments = ["My manager is a nightmare and overtime is unpaid.", "Great team, terrible pay."];

    const result = summarizeCommentThemes(comments);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("nightmare");
    expect(serialized).not.toContain("Great team");
    expect(serialized).not.toContain("terrible pay");
  });

  it("counts a theme once per comment even if its keyword appears multiple times in that comment", () => {
    const comments = ["overtime overtime overtime, so much overtime"];

    const result = summarizeCommentThemes(comments);

    expect(result.find((t) => t.theme === "Work-Life Balance")?.mentionCount).toBe(1);
  });

  it("tallies each theme across multiple distinct comments", () => {
    const comments = [
      "My manager never listens.",
      "Management here is actually pretty good.",
      "Nothing bad to say about pay.",
    ];

    const result = summarizeCommentThemes(comments);

    expect(result.find((t) => t.theme === "Leadership & Management")?.mentionCount).toBe(2);
  });

  it("matches Turkish keywords case-insensitively too", () => {
    const comments = ["Yönetim gerçekten çok kötüydü."];

    const result = summarizeCommentThemes(comments);

    expect(result.find((t) => t.theme === "Leadership & Management")?.mentionCount).toBe(1);
  });

  it("does not match a keyword as a substring of an unrelated word", () => {
    // "team" should not match inside "steamroller"
    const comments = ["The new steamroller at the site is loud."];

    const result = summarizeCommentThemes(comments);

    expect(result.find((t) => t.theme === "Culture")?.mentionCount ?? 0).toBe(0);
  });

  it("returns zero-count entries for themes nobody mentioned, not an omitted entry", () => {
    const result = summarizeCommentThemes(["A totally neutral comment about the weather."]);

    expect(result.every((t) => t.mentionCount === 0)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles zero comments without throwing", () => {
    const result = summarizeCommentThemes([]);

    expect(result.every((t) => t.mentionCount === 0)).toBe(true);
  });

  it("ignores comments that are empty or only whitespace", () => {
    const result = summarizeCommentThemes(["", "   ", "team spirit is great here"]);

    expect(result.find((t) => t.theme === "Culture")?.mentionCount).toBe(1);
  });
});

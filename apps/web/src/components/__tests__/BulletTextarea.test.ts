import { continueList, toggleList } from "../BulletTextarea";

const B = "• ";

describe("BulletTextarea list helpers", () => {
  it("turns the selected lines into bullets, and back", () => {
    const text = "Shift work\nMeal card\nTransport";
    const on = toggleList(text, 0, text.length, "bullet");
    expect(on.text).toBe(`${B}Shift work\n${B}Meal card\n${B}Transport`);
    const off = toggleList(on.text, 0, on.text.length, "bullet");
    expect(off.text).toBe(text);
  });

  it("only touches the line the caret is on", () => {
    const text = "Intro\nMeal card";
    const caret = text.length;
    expect(toggleList(text, caret, caret, "bullet").text).toBe(`Intro\n${B}Meal card`);
  });

  it("numbers the selected lines from 1, replacing bullets", () => {
    const text = `${B}First\n${B}Second`;
    expect(toggleList(text, 0, text.length, "number").text).toBe("1. First\n2. Second");
  });

  it("Enter carries a bullet list on to the next line", () => {
    const text = `${B}First`;
    expect(continueList(text, text.length)).toEqual({ text: `${B}First\n${B}`, caret: text.length + 3 });
  });

  it("Enter carries a numbered list on with the next number", () => {
    const text = "1. First";
    expect(continueList(text, text.length)?.text).toBe("1. First\n2. ");
  });

  it("Enter on an empty list line ends the list", () => {
    const text = `${B}First\n${B}`;
    expect(continueList(text, text.length)).toEqual({ text: `${B}First\n`, caret: 8 });
  });

  it("leaves Enter alone on a plain line", () => {
    expect(continueList("Just text", 9)).toBeNull();
  });
});

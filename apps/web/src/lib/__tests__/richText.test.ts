import { continueList, parseMarkup, stripMarkup, toMarkup, toggleList } from "../richText";

const B = "• ";

describe("list helpers", () => {
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

describe("bold and italic text", () => {
  it("reads **bold** and __italic__, and writes the same text back", () => {
    const stored = "We offer **a meal card** and __flexible__ hours. **__Both__** here.";
    const doc = parseMarkup(stored);
    expect(doc.text).toBe("We offer a meal card and flexible hours. Both here.");
    expect(doc.styles[doc.text.indexOf("meal")]).toEqual({ b: true, i: false });
    expect(doc.styles[doc.text.indexOf("flexible")]).toEqual({ b: false, i: true });
    expect(doc.styles[doc.text.indexOf("Both")]).toEqual({ b: true, i: true });
    expect(parseMarkup(toMarkup(doc))).toEqual(doc);
  });

  it("keeps a marker with no partner as plain text", () => {
    expect(stripMarkup("Price ** per hour")).toBe("Price ** per hour");
    expect(stripMarkup("a__b")).toBe("a__b");
  });

  it("closes styles at the end of each line, so lists stay intact", () => {
    const doc = parseMarkup("• **Shift**\n2. __Night__ work");
    expect(doc.text).toBe("• Shift\n2. Night work");
    expect(toMarkup(doc)).toBe("• **Shift**\n2. __Night__ work");
  });
});

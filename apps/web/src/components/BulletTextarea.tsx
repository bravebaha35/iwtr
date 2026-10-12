"use client";

import { useRef } from "react";

const BULLET = "• ";
const NUMBER_RE = /^(\d+)\. /;

type ListKind = "bullet" | "number";

function stripMarker(line: string): string {
  if (line.startsWith(BULLET)) return line.slice(BULLET.length);
  const m = NUMBER_RE.exec(line);
  return m ? line.slice(m[0].length) : line;
}

/**
 * Turns the lines touched by the selection into a bullet / numbered list,
 * or back into plain lines when they all already are that kind of list.
 * Returns the new text and where the selection should sit afterwards.
 */
export function toggleList(
  text: string,
  selStart: number,
  selEnd: number,
  kind: ListKind,
): { text: string; selStart: number; selEnd: number } {
  const blockStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const nextBreak = text.indexOf("\n", selEnd);
  const blockEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(blockStart, blockEnd).split("\n");
  const isKind = (line: string) => (kind === "bullet" ? line.startsWith(BULLET) : NUMBER_RE.test(line));
  const allOn = lines.every(isKind);
  const next = lines
    .map((line, i) => {
      const bare = stripMarker(line);
      if (allOn) return bare;
      return kind === "bullet" ? BULLET + bare : `${i + 1}. ${bare}`;
    })
    .join("\n");
  return {
    text: text.slice(0, blockStart) + next + text.slice(blockEnd),
    selStart: blockStart,
    selEnd: blockStart + next.length,
  };
}

/**
 * What Enter does inside a list: carries the list on to a new line, or -
 * on a line that holds nothing but its marker - ends the list. Null when
 * the caret isn't on a list line (Enter then behaves as usual).
 */
export function continueList(text: string, caret: number): { text: string; caret: number } | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  const numbered = NUMBER_RE.exec(line);
  const marker = line.startsWith(BULLET) ? BULLET : numbered ? numbered[0] : null;
  if (!marker) return null;
  if (line.length === marker.length) {
    // An empty list line: Enter ends the list.
    return { text: text.slice(0, lineStart) + text.slice(caret), caret: lineStart };
  }
  const nextMarker = numbered ? `${Number(numbered[1]) + 1}. ` : BULLET;
  const insert = `\n${nextMarker}`;
  return { text: text.slice(0, caret) + insert + text.slice(caret), caret: caret + insert.length };
}

/**
 * A plain-text box with basic list help, for a job posting's "Tell us
 * more": a Bullet list and a Numbered list button, Enter carries a list on,
 * Enter on an empty list line ends it, and "- " or "* " typed at the start
 * of a line becomes a bullet. What's stored is ordinary text (bullets are
 * the "•" character), so it shows the same everywhere it's printed.
 */
export function BulletTextarea({
  value,
  onChange,
  maxLength,
  placeholder,
  id,
  className = "",
  textareaClassName = "",
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  placeholder?: string;
  id?: string;
  // On the wrapper (toolbar + box): give it a height and the box fills it.
  className?: string;
  textareaClassName?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(next: string, selStart: number, selEnd: number = selStart) {
    const clipped = next.slice(0, maxLength);
    onChange(clipped);
    // After React has put the new text in the box.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(Math.min(selStart, clipped.length), Math.min(selEnd, clipped.length));
    });
  }

  function toggle(kind: ListKind) {
    const el = ref.current;
    if (!el) return;
    const out = toggleList(value, el.selectionStart, el.selectionEnd, kind);
    apply(out.text, out.selEnd);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const caret = el.selectionStart;
    if (e.key === "Enter" && !e.shiftKey) {
      const out = continueList(value, caret);
      if (!out) return;
      e.preventDefault();
      apply(out.text, out.caret);
      return;
    }
    if (e.key === " ") {
      // "- " or "* " at the start of a line becomes a bullet.
      const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
      const typed = value.slice(lineStart, caret);
      if (typed === "-" || typed === "*") {
        e.preventDefault();
        apply(value.slice(0, lineStart) + BULLET + value.slice(caret), lineStart + BULLET.length);
      }
    }
  }

  const toolButton =
    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition focus-within:border-brand-600 dark:focus-within:border-brand-400 ${className}`}
    >
      <div className="flex items-center gap-0.5 border-b border-border/70 px-1.5 py-1">
        <button type="button" onClick={() => toggle("bullet")} title="Bullet list" className={toolButton}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          Bullet list
        </button>
        <button type="button" onClick={() => toggle("number")} title="Numbered list" className={toolButton}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 6h10M10 12h10M10 18h10" />
            <path d="M4 4.6l1.3-.8v4.4M3.7 11.4h2.4l-2.4 3.2h2.6" strokeWidth="1.5" />
          </svg>
          Numbered list
        </button>
        <span className="ml-auto hidden pr-2 text-[11px] text-muted-foreground sm:inline">
          Enter starts the next item
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onKeyDown={onKeyDown}
        className={`thin-scrollbar min-h-0 w-full flex-1 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none ${textareaClassName}`}
      />
    </div>
  );
}

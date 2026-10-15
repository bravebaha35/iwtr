import { Fragment } from "react";
import { parseMarkup } from "@/lib/richText";

/**
 * Shows a job posting's "Tell us more" with its bold and italic words (see
 * lib/richText). Built from React elements only - the stored text is never
 * treated as HTML. Line breaks and list lines print as typed, so give the
 * element `whitespace-pre-wrap` through `className`.
 */
export function RichText({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "p" | "div" }) {
  const { text: plain, styles } = parseMarkup(text);
  const parts: { text: string; b: boolean; i: boolean }[] = [];
  for (let k = 0; k < plain.length; k++) {
    const s = styles[k];
    const last = parts[parts.length - 1];
    if (last && last.b === s.b && last.i === s.i) last.text += plain[k];
    else parts.push({ text: plain[k], b: s.b, i: s.i });
  }
  return (
    <Tag className={className}>
      {parts.map((p, n) => {
        let node: React.ReactNode = p.text;
        if (p.i) node = <em>{node}</em>;
        if (p.b) node = <strong className="font-semibold text-foreground">{node}</strong>;
        return <Fragment key={n}>{node}</Fragment>;
      })}
    </Tag>
  );
}

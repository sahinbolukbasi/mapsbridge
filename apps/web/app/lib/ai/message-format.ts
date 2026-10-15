export interface MessageBlock {
  kind: "paragraph" | "heading" | "list";
  lines: string[];
  ordered?: boolean;
}
/** Small, deliberately bounded Markdown subset; never interprets model HTML. */
export function messageBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      blocks.push({ kind: "paragraph", lines: [] });
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/u);
    const item = line.match(/^\s*(?:([-*•])|\d+[.)])\s+(.+)$/u);
    const kind = heading ? "heading" : item ? "list" : "paragraph";
    const ordered = item ? !item[1] : undefined;
    const previous = blocks[blocks.length - 1];
    const value = heading?.[1] || item?.[2] || line;
    if (previous && previous.kind === kind && kind !== "heading" && previous.ordered === ordered)
      previous.lines.push(value);
    else blocks.push({ kind, lines: [value], ...(item ? { ordered } : {}) });
  }
  return blocks.filter((block) => block.lines.length);
}
export interface InlinePart {
  kind: "text" | "strong" | "code" | "link";
  text: string;
  href?: string;
}
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/gu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > cursor) parts.push({ kind: "text", text: text.slice(cursor, match.index) });
    if (match[1]) parts.push({ kind: "strong", text: match[1] });
    else if (match[2]) parts.push({ kind: "code", text: match[2] });
    else parts.push({ kind: "link", text: match[3], href: match[4] });
    cursor = match.index! + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: "text", text: text.slice(cursor) });
  return parts;
}

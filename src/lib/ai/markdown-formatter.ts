import { removeEmDashes } from "../utils";

/**
 * Normalizes markdown spacing deterministically. Rules apply only outside fenced code
 * blocks, so "# comment" lines in bash snippets and table-like text in code stay as written.
 */
export async function formatMarkdownWithAI(
  content: string,
  _apiKey?: string,
): Promise<string> {
  if (!content?.trim()) return content;
  return formatMarkdownRuleBased(content);
}

function formatProse(text: string): string {
  return (
    text
      // Ensure space after # in headings
      .replace(/^(#{1,6})([^\s#])/gm, "$1 $2")
      // Blank line before and after headings
      .replace(/^([^\n]*\S[^\n]*)\n(#{1,6}\s)/gm, "$1\n\n$2")
      .replace(/^(#{1,6}\s[^\n]+)\n(?!\n)/gm, "$1\n\n")
      // Blank line before a table's first row only (never between rows)
      .replace(/^(?![ \t]*\|)([^\n]*\S[^\n]*)\n([ \t]*\|)/gm, "$1\n\n$2")
  );
}

export function formatMarkdownRuleBased(content: string): string {
  if (!content) return content;
  // Odd indexes are fenced code blocks (the capture group keeps them in the array).
  const parts = content.split(
    /(^[ \t]*(?:```|~~~)[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$)/m,
  );
  const formatted = parts
    .map((part, i) => (i % 2 === 1 ? part : removeEmDashes(formatProse(part))))
    .join("");
  return formatted.replace(/\n{3,}/g, "\n\n").trim();
}

/** Removes a leading "# Title" or "**Title**" line that repeats the post title. */
export function stripLeadingTitle(content: string, title: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const lines = content.trimStart().split("\n");
  const first = lines[0]
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1");
  if (normalize(first) === normalize(title)) {
    return lines.slice(1).join("\n").trimStart();
  }
  return content;
}

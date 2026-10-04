import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

export function removeEmDashes(content: string): string {
  if (!content) return content;
  return content
    .replace(/(\w)\s*—\s*(\w)/g, "$1, $2")
    .replace(/^\s*—\s*/gm, "")
    .replace(/\s*—\s*([A-Z])/g, ". $1")
    .replace(/—/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function generateExcerpt(
  content: string,
  maxLength: number = 150,
): string {
  const clean = content
    .replace(/[#*`_\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  const truncated = clean.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0
    ? truncated.substring(0, lastSpace) + "..."
    : truncated + "...";
}

export function isTableBlock(block: string): boolean {
  return /^\s*\|.*\|\s*$/m.test(block);
}

export function isListBlock(block: string): boolean {
  return /^\s*([*\-+]|\d+\.)\s+/m.test(block);
}

export function isCodeBlock(block: string): boolean {
  return /^\s*(```|~~~)/.test(block);
}

/** True for blocks that must never be rewritten: headings, tables, lists, code, quotes, rules. */
export function isStructuralBlock(block: string): boolean {
  const trimmed = block.trimStart();
  return (
    /^\s/.test(block) || // indented: list item continuation or nested content
    isCodeBlock(block) ||
    isTableBlock(block) ||
    isListBlock(block) ||
    trimmed.startsWith("#") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith("<") ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)
  );
}

/**
 * Splits markdown into blank-line separated blocks. Tables and fenced code blocks are
 * kept whole (including blank lines inside a fence), so joining the result with "\n\n"
 * round-trips the document.
 */
export function splitContentPreservingTables(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inTable = false;
  let fence: string | null = null;

  const flush = () => {
    if (currentBlock.length > 0) {
      // Keep leading indentation: an indented block belongs to the list item above it.
      blocks.push(currentBlock.join("\n").trimEnd());
      currentBlock = [];
    }
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);

    if (fence) {
      currentBlock.push(line);
      if (fenceMatch && fenceMatch[1] === fence) {
        fence = null;
        flush();
      }
      continue;
    }

    if (fenceMatch) {
      flush();
      inTable = false;
      fence = fenceMatch[1];
      currentBlock.push(line);
      continue;
    }

    const isTableLine = /^\s*\|.*\|\s*$/.test(line);

    if (isTableLine) {
      if (!inTable) {
        flush();
        inTable = true;
      }
      currentBlock.push(line);
    } else {
      if (inTable) {
        flush();
        inTable = false;
      }
      if (line.trim() === "") {
        flush();
      } else {
        currentBlock.push(line);
      }
    }
  }

  flush();
  return blocks.filter((b) => b.trim().length > 0);
}

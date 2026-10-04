import { requireStudioConfig } from "../studio-config";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Trust signals must be real. This step used to prefix paragraphs with invented
 * authority claims ("According to enforcement records,"), which is the opposite
 * of E-E-A-T. It now only appends the context file's disclaimer to posts that mention
 * one of its trigger words, unless the article already includes a disclaimer.
 */
export function optimizeForEEAT(content: string): string {
  const { disclaimer } = requireStudioConfig().brand;
  if (!disclaimer?.triggers.length) return content;

  const triggers = new RegExp(
    `\\b(${disclaimer.triggers.map(escapeRegex).join("|")})\\b`,
    "i",
  );
  if (!triggers.test(content)) return content;
  if (
    content.includes(disclaimer.text) ||
    /not (a law firm|(legal|medical|financial|tax|professional) advice)/i.test(
      content,
    )
  ) {
    return content;
  }

  return `${content.trim()}\n\n---\n\n*${disclaimer.text}*`;
}

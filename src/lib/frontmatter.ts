import { MetaData } from "@/types/content";
import {
  BrandContext,
  FRONTMATTER_FIELDS,
  FrontmatterField,
} from "./studio-config";

/**
 * Output frontmatter. The default schema is
 *   title, meta_title, description, date, updated, categories, tags, draft
 * and the context file's `frontmatter.fields` can rename a key or drop it (false).
 * `frontmatter.extra` adds fixed keys (e.g. author, layout) after the standard ones.
 */

/** The key a field is written under, or null when the site doesn't use it. */
export function frontmatterKey(
  brand: BrandContext,
  field: FrontmatterField,
): string | null {
  const mapped = brand.frontmatter.fields[field];
  if (mapped === false) return null;
  return mapped || field;
}

// JSON strings, arrays and objects are valid YAML flow values.
function yamlValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value);
}

function fieldValue(meta: MetaData, field: FrontmatterField): unknown {
  switch (field) {
    case "date":
      return meta.date;
    case "updated":
      return meta.updated;
    case "draft":
      return meta.draft;
    default:
      return meta[field];
  }
}

export function renderMarkdownWithFrontmatter(
  brand: BrandContext,
  meta: MetaData,
  markdownBody: string,
): string {
  const lines: string[] = [];
  for (const field of FRONTMATTER_FIELDS) {
    const key = frontmatterKey(brand, field);
    const value = fieldValue(meta, field);
    if (!key || value === undefined) continue;
    // Dates stay unquoted so static site generators parse them as dates.
    lines.push(
      `${key}: ${field === "date" || field === "updated" ? String(value) : yamlValue(value)}`,
    );
  }
  for (const [key, value] of Object.entries(brand.frontmatter.extra)) {
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  return `---\n${lines.join("\n")}\n---\n\n${markdownBody}`.trim();
}

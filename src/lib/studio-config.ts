import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { z } from "zod";

/**
 * Server-only configuration. Wiring (paths, URLs, models) comes from .env, brand
 * knowledge from one context file (Markdown with YAML frontmatter, see
 * examples/content-context.example.md). Both are validated with zod and cached until
 * .env values or the context file change.
 */

const text = z.string().trim().min(1);
const textList = z.array(text).default([]);

const frontmatterKey = z.union([text, z.literal(false)]).optional();

/** Output frontmatter fields, in the order they are written. */
export const FRONTMATTER_FIELDS = [
  "title",
  "meta_title",
  "description",
  "date",
  "updated",
  "categories",
  "tags",
  "draft",
] as const;
export type FrontmatterField = (typeof FRONTMATTER_FIELDS)[number];

const contextSchema = z
  .object({
    name: text.optional(),
    tagline: text.optional(),
    industry: text,
    summary: text,
    audience: z
      .array(z.object({ name: text, needs: text.optional() }).strict())
      .default([]),
    product: z
      .object({
        does: textList,
        doesNot: textList,
        pages: z
          .array(z.object({ url: text, label: text }).strict())
          .default([]),
      })
      .strict()
      .default({}),
    facts: z
      .object({
        allowed: z
          .array(
            z.union([
              text.transform((fact) => ({ fact, source: undefined })),
              z.object({ fact: text, source: text.optional() }).strict(),
            ]),
          )
          .default([]),
        banned: textList,
      })
      .strict()
      .default({}),
    links: z
      .array(
        z.object({ url: text, anchor: text, triggers: textList }).strict(),
      )
      .default([]),
    cta: text.optional(),
    categories: z
      .array(
        z.union([
          text.transform((name) => ({ name, keywords: [] as string[] })),
          z.object({ name: text, keywords: textList }).strict(),
        ]),
      )
      .default([]),
    defaultCategory: text.optional(),
    tags: textList,
    acronyms: textList,
    competitors: textList,
    avoidTopics: textList,
    planning: textList,
    outline: textList,
    disclaimer: z.object({ text, triggers: textList }).strict().optional(),
    voiceExamples: z
      .array(z.object({ draft: text, rewrite: text }).strict())
      .default([]),
    frontmatter: z
      .object({
        fields: z
          .object({
            title: frontmatterKey,
            meta_title: frontmatterKey,
            description: frontmatterKey,
            date: frontmatterKey,
            updated: frontmatterKey,
            categories: frontmatterKey,
            tags: frontmatterKey,
            draft: frontmatterKey,
          })
          .strict()
          .default({}),
        extra: z.record(z.string(), z.unknown()).default({}),
      })
      .strict()
      .default({}),
  })
  .strict();

// .env values; empty strings count as missing.
const optionalEnv = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().optional(),
);
const requiredEnv = (name: string, hint: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string({ required_error: `${name} is not set. ${hint}` }).trim(),
  );

const envSchema = z.object({
  CONTENT_CONTEXT_FILE: requiredEnv(
    "CONTENT_CONTEXT_FILE",
    "Point it at your brand context file.",
  ),
  SITE_NAME: requiredEnv("SITE_NAME", "Use your site's display name."),
  SITE_URL: requiredEnv("SITE_URL", "Use the site's public URL.").pipe(
    z.string().url("SITE_URL must be a full URL like https://example.com"),
  ),
  BLOG_PATH: optionalEnv,
  CONTENT_OUTPUT_DIR: requiredEnv(
    "CONTENT_OUTPUT_DIR",
    "Use the folder your site reads blog posts from.",
  ),
  CALENDAR_FILE: optionalEnv,
});

export type BrandContext = Omit<z.infer<typeof contextSchema>, "name"> & {
  name: string;
  /** Markdown body of the context file: free-form brand and fact guidance. */
  guide: string;
};

export interface SiteConfig {
  name: string;
  /** No trailing slash */
  url: string;
  /** e.g. "example.com" */
  host: string;
  /** Leading slash, no trailing slash; "" when posts live at the site root */
  blogPath: string;
  outputDir: string;
  calendarFile: string;
  contextFile: string;
}

export interface StudioConfig {
  site: SiteConfig;
  brand: BrandContext;
}

export type StudioConfigResult =
  | ({ ok: true } & StudioConfig)
  | { ok: false; errors: string[] };

export class SetupError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`Content Studio isn't set up: ${errors.join(" ")}`);
    this.name = "SetupError";
    this.errors = errors;
  }
}

const resolvePath = (p: string) => path.resolve(process.cwd(), p);

function normalizeBlogPath(p: string | undefined): string {
  const trimmed = (p ?? "/blog").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

function formatIssues(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.join(".");
    return `${prefix}${where ? `${where}: ` : ""}${issue.message}`;
  });
}

let cache: { key: string; result: StudioConfigResult } | null = null;

function load(): StudioConfigResult {
  const env = envSchema.safeParse(process.env);
  if (!env.success) return { ok: false, errors: formatIssues("", env.error) };

  const contextFile = resolvePath(env.data.CONTENT_CONTEXT_FILE);
  if (!fs.existsSync(contextFile)) {
    return {
      ok: false,
      errors: [
        `The context file ${contextFile} doesn't exist. Set CONTENT_CONTEXT_FILE in .env (start from examples/content-context.example.md).`,
      ],
    };
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    // Fresh object each time: gray-matter caches by content otherwise.
    parsed = matter(fs.readFileSync(contextFile, "utf-8"), {});
  } catch (err: any) {
    return {
      ok: false,
      errors: [
        `Couldn't read the frontmatter in ${contextFile}: ${err?.message || err}`,
      ],
    };
  }

  const context = contextSchema.safeParse(parsed.data);
  if (!context.success) {
    return {
      ok: false,
      errors: formatIssues(`${path.basename(contextFile)} → `, context.error),
    };
  }

  const url = env.data.SITE_URL.replace(/\/+$/, "");
  const site: SiteConfig = {
    name: env.data.SITE_NAME,
    url,
    host: new URL(url).host,
    blogPath: normalizeBlogPath(env.data.BLOG_PATH),
    outputDir: resolvePath(env.data.CONTENT_OUTPUT_DIR),
    calendarFile: resolvePath(
      env.data.CALENDAR_FILE || "./data/content-calendar.json",
    ),
    contextFile,
  };

  return {
    ok: true,
    site,
    brand: {
      ...context.data,
      name: context.data.name || site.name,
      guide: parsed.content.trim(),
    },
  };
}

/** Loads and validates .env + the context file. Never throws. */
export function getStudioConfig(): StudioConfigResult {
  const envKeys = Object.keys(envSchema.shape) as (keyof typeof envSchema.shape)[];
  const contextPath = process.env.CONTENT_CONTEXT_FILE?.trim();
  let mtime = 0;
  try {
    if (contextPath) mtime = fs.statSync(resolvePath(contextPath)).mtimeMs;
  } catch {
    // Missing file: load() reports it.
  }
  const key = [...envKeys.map((k) => process.env[k] ?? ""), mtime].join("|");
  if (cache?.key !== key) cache = { key, result: load() };
  return cache.result;
}

/** Same as getStudioConfig(), but throws a SetupError when something is missing. */
export function requireStudioConfig(): StudioConfig {
  const result = getStudioConfig();
  if (!result.ok) throw new SetupError(result.errors);
  return { site: result.site, brand: result.brand };
}

/** Groq model ids. Independent of the context file so the key check works during setup. */
export function getModelConfig() {
  const list = (v: string | undefined, fallback: string[]) => {
    const items = (v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length ? items : fallback;
  };
  return {
    draft: process.env.DRAFT_MODEL?.trim() || "openai/gpt-oss-120b",
    fast: process.env.FAST_MODEL?.trim() || "openai/gpt-oss-20b",
    rewrite: list(process.env.REWRITE_MODELS, [
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-120b",
    ]),
  };
}

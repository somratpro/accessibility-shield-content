import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { z } from "zod";

/**
 * Server-only configuration. .env holds paths and keys (CONTENT_DIR, optional
 * CONTEXT_FILE); the site itself (name, url, brand) is described in one context file
 * (Markdown with YAML frontmatter, see examples/content-context.example.md), found at:
 *
 * 1. CONTEXT_FILE, if set
 * 2. the nearest content-context.md in CONTENT_DIR or any folder above it
 * 3. ./content-context.md in this folder
 *
 * The ideas list is stored next to the context file. Both are validated with zod
 * and cached until .env values or the context file change.
 */

export const CONTEXT_FILENAME = "content-context.md";
export const IDEAS_FILENAME = "content-ideas.json";

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
    name: text,
    url: text.pipe(
      z.string().url("must be a full URL like https://example.com"),
    ),
    // URL path posts are served under; defaults to "/" + the CONTENT_DIR folder name.
    blogPath: z.string().trim().optional(),
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
      .array(z.object({ url: text, anchor: text, triggers: textList }).strict())
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
    allowedWords: textList,
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

const envValue = (name: string) => process.env[name]?.trim() || undefined;

export type BrandContext = Omit<z.infer<typeof contextSchema>, "url"> & {
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
  /** Folder posts are read from and saved to */
  contentDir: string;
  ideasFile: string;
  contextFile: string;
}

export interface StudioConfig {
  site: SiteConfig;
  brand: BrandContext;
}

/** What the setup screen needs to show the next step. */
export interface SetupProblem {
  /** 1: CONTENT_DIR is missing or wrong. 2: the context file is missing or invalid. */
  step: 1 | 2;
  errors: string[];
  contentDir?: string;
  /** The context file in use, or where to create one (the site's repo root). */
  contextFile?: string;
  /** True when the context file exists but has errors. */
  contextExists?: boolean;
  /** True when nothing is configured yet: not a mistake to report. */
  firstRun?: boolean;
}

export type StudioConfigResult =
  | ({ ok: true } & StudioConfig)
  | ({ ok: false } & SetupProblem);

export class SetupError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`Content Studio isn't set up: ${errors.join(" ")}`);
    this.name = "SetupError";
    this.errors = errors;
  }
}

const resolvePath = (p: string) => path.resolve(process.cwd(), p);

function normalizeBlogPath(p: string): string {
  const trimmed = p.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

function formatIssues(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.join(".");
    if (where && issue.message === "Required")
      return `${prefix}${where} is missing`;
    return `${prefix}${where ? `${where}: ` : ""}${issue.message}`;
  });
}

function findContextFile(contentDir: string): string | null {
  const explicit = envValue("CONTEXT_FILE");
  if (explicit) return resolvePath(explicit);
  for (let dir = contentDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, CONTEXT_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) break;
  }
  const local = resolvePath(CONTEXT_FILENAME);
  return fs.existsSync(local) ? local : null;
}

// The site's repo root: the nearest folder above CONTENT_DIR with .git or package.json.
function guessRepoRoot(contentDir: string): string {
  for (
    let dir = contentDir;
    path.dirname(dir) !== dir;
    dir = path.dirname(dir)
  ) {
    if (["package.json", ".git"].some((f) => fs.existsSync(path.join(dir, f))))
      return dir;
  }
  return contentDir;
}

/** CONTENT_DIR and the context file it leads to, or what's missing. */
function locate(): { contentDir: string; contextFile: string } | SetupProblem {
  const dir = envValue("CONTENT_DIR");
  if (!dir) {
    return {
      step: 1,
      firstRun: !envValue("CONTENT_OUTPUT_DIR"),
      errors: [
        envValue("CONTENT_OUTPUT_DIR")
          ? "CONTENT_OUTPUT_DIR was renamed to CONTENT_DIR. Rename it in .env (BLOG_PATH, CALENDAR_FILE, SITE_NAME and SITE_URL are no longer used: the site's name and url go in the context file)."
          : "CONTENT_DIR is not set in .env.",
      ],
    };
  }
  const contentDir = resolvePath(dir);
  if (!fs.existsSync(contentDir) || !fs.statSync(contentDir).isDirectory()) {
    return {
      step: 1,
      errors: [`CONTENT_DIR points to ${contentDir}, which isn't a folder.`],
    };
  }

  const contextFile = findContextFile(contentDir);
  if (!contextFile || !fs.existsSync(contextFile)) {
    return {
      step: 2,
      contentDir,
      contextFile:
        contextFile ?? path.join(guessRepoRoot(contentDir), CONTEXT_FILENAME),
      errors: [
        contextFile
          ? `CONTEXT_FILE ${contextFile} doesn't exist.`
          : `No ${CONTEXT_FILENAME} found in ${contentDir} or the folders above it.`,
      ],
    };
  }
  return { contentDir, contextFile };
}

let cache: { key: string; result: StudioConfigResult } | null = null;

function load(contentDir: string, contextFile: string): StudioConfigResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    // Fresh object each time: gray-matter caches by content otherwise.
    parsed = matter(fs.readFileSync(contextFile, "utf-8"), {});
  } catch (err: any) {
    return {
      ok: false,
      step: 2,
      contentDir,
      contextFile,
      contextExists: true,
      errors: [
        `The YAML at the top of the file couldn't be read: ${err?.message || err}`,
      ],
    };
  }

  const context = contextSchema.safeParse(parsed.data);
  if (!context.success) {
    return {
      ok: false,
      step: 2,
      contentDir,
      contextFile,
      contextExists: true,
      errors: formatIssues("", context.error),
    };
  }

  const { url: rawUrl, ...brand } = context.data;
  const url = rawUrl.replace(/\/+$/, "");
  const site: SiteConfig = {
    name: brand.name,
    url,
    host: new URL(url).host,
    blogPath: normalizeBlogPath(
      context.data.blogPath ?? path.basename(contentDir),
    ),
    contentDir,
    ideasFile: path.join(path.dirname(contextFile), IDEAS_FILENAME),
    contextFile,
  };

  return {
    ok: true,
    site,
    brand: { ...brand, guide: parsed.content.trim() },
  };
}

/** Loads and validates .env + the context file. Never throws. */
export function getStudioConfig(): StudioConfigResult {
  const located = locate();
  if ("step" in located) return { ok: false, ...located };

  const { contentDir, contextFile } = located;
  const key = [contentDir, contextFile, fs.statSync(contextFile).mtimeMs].join(
    "|",
  );
  if (cache?.key !== key)
    cache = { key, result: load(contentDir, contextFile) };
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

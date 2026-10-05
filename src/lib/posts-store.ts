import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { frontmatterKey } from "./frontmatter";
import { BrandContext, requireStudioConfig } from "./studio-config";

/** The folder posts are read from and written to (CONTENT_DIR). */
export function getContentDir(): string {
  return requireStudioConfig().site.contentDir;
}

export interface ExistingBlogPostMeta {
  filename: string;
  slug: string;
  title: string;
  meta_title?: string;
  description?: string;
  date?: string;
  categories: string[];
  tags: string[];
  wordCount: number;
  charCount: number;
  filePath: string;
}

export interface ExistingBlogPostFull extends ExistingBlogPostMeta {
  rawMarkdown: string;
  body: string;
  frontmatter: Record<string, any>;
}

function readPost(
  brand: BrandContext,
  filename: string,
  fullPath: string,
): ExistingBlogPostFull {
  const content = fs.readFileSync(fullPath, "utf-8");
  const parsed = matter(content, {});
  const data = parsed.data || {};
  const get = (field: Parameters<typeof frontmatterKey>[1]) => {
    const key = frontmatterKey(brand, field);
    return key ? data[key] : undefined;
  };
  const slug = filename.replace(/\.md$/, "");
  const date = get("date");
  const categories = get("categories");
  const tags = get("tags");

  return {
    filename,
    slug,
    title: get("title") || slug,
    meta_title: get("meta_title"),
    description: get("description"),
    date: date ? new Date(date).toISOString() : undefined,
    categories: Array.isArray(categories) ? categories : [],
    tags: Array.isArray(tags) ? tags : [],
    wordCount: parsed.content.trim().split(/\s+/).filter(Boolean).length,
    charCount: content.length,
    filePath: fullPath,
    rawMarkdown: content,
    body: parsed.content,
    frontmatter: data,
  };
}

/** Lists the markdown posts in the content folder (files starting with "_" are skipped). */
export function getExistingBlogPosts(): ExistingBlogPostMeta[] {
  const { site, brand } = requireStudioConfig();
  if (!fs.existsSync(site.contentDir)) return [];

  const posts: ExistingBlogPostMeta[] = [];
  for (const file of fs.readdirSync(site.contentDir)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    try {
      const { rawMarkdown, body, frontmatter, ...meta } = readPost(
        brand,
        file,
        path.join(site.contentDir, file),
      );
      posts.push(meta);
    } catch (e) {
      console.warn(`Could not parse blog post ${file}:`, e);
    }
  }

  return posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** Loads a single post by its slug or filename. */
export function getExistingBlogPostBySlug(
  slugOrFilename: string,
): ExistingBlogPostFull | null {
  const { site, brand } = requireStudioConfig();
  const filename = path.basename(
    slugOrFilename.endsWith(".md") ? slugOrFilename : `${slugOrFilename}.md`,
  );
  const fullPath = path.join(site.contentDir, filename);
  if (!fs.existsSync(fullPath)) return null;

  try {
    return readPost(brand, filename, fullPath);
  } catch (e) {
    console.error(`Error loading blog post ${slugOrFilename}:`, e);
    return null;
  }
}

export function postExists(slug: string): boolean {
  try {
    return fs.existsSync(path.join(getContentDir(), `${slug}.md`));
  } catch {
    return false;
  }
}

/** Writes or overwrites a post in the content folder. */
export function savePost(
  filename: string,
  content: string,
): {
  success: boolean;
  filePath: string;
  alreadyExisted: boolean;
  bytes: number;
} {
  const dir = getContentDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeFilename = path.basename(filename).endsWith(".md")
    ? path.basename(filename)
    : `${path.basename(filename)}.md`;

  const targetFilePath = path.join(dir, safeFilename);
  const alreadyExisted = fs.existsSync(targetFilePath);

  fs.writeFileSync(targetFilePath, content, "utf-8");

  return {
    success: true,
    filePath: targetFilePath,
    alreadyExisted,
    bytes: Buffer.byteLength(content, "utf-8"),
  };
}

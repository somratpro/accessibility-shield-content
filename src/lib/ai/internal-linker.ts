import { requireStudioConfig } from "../studio-config";
import { isStructuralBlock, splitContentPreservingTables } from "../utils";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// Models often write routes as **/pricing** or `/pricing` instead of linking them.
function linkBareRoutes(text: string, routes: string[]): string {
  if (routes.length === 0) return text;
  return text.replace(
    new RegExp(`(\\*\\*|\`)(${routes.map(escapeRegex).join("|")})\\1`, "g"),
    (_, __, route: string) => `[${route}](${route})`,
  );
}

export function optimizeInternalLinking(content: string): string {
  const { brand } = requireStudioConfig();
  const links = brand.links;
  // Longest first so "/plans/pro" wins over "/plans".
  const routes = Array.from(
    new Set(
      [...links.map((l) => l.url), ...brand.product.pages.map((p) => p.url)]
        .filter((url) => url.startsWith("/")),
    ),
  ).sort((a, b) => b.length - a.length);

  const blocks = splitContentPreservingTables(content).map((b) =>
    isStructuralBlock(b) && /^\s*(```|~~~|\|)/.test(b)
      ? b
      : linkBareRoutes(b, routes),
  );
  const usedLinks = new Set<string>();

  // Links the article already contains (e.g. the model linked a page itself) count as used.
  const linkedSoFar = blocks.join("\n\n");
  for (const url of [...links.map((l) => l.url), ...routes]) {
    if (linkedSoFar.includes(`](${url})`)) usedLinks.add(url);
  }

  for (let i = 0; i < blocks.length; i++) {
    if (isStructuralBlock(blocks[i])) continue;

    for (const linkDef of links) {
      if (usedLinks.has(linkDef.url)) continue;

      for (const trigger of linkDef.triggers) {
        const escaped = escapeRegex(trigger);
        // Skip matches inside existing link text or inline code.
        const regex = new RegExp(
          `(?<![\\[\`])\\b(${escaped})\\b(?![^\\[]*\\]\\()`,
          "i",
        );
        if (regex.test(blocks[i])) {
          blocks[i] = blocks[i].replace(regex, `[$1](${linkDef.url})`);
          usedLinks.add(linkDef.url);
          break;
        }
      }
      if (usedLinks.size >= 4) break; // Keep links natural, maximum 3-4 per post
    }
  }

  // If no links were placed naturally, add the context file's call to action at the end
  if (usedLinks.size === 0 && brand.cta) {
    blocks.push(`---\n\n*${brand.cta.replace(/^\*+|\*+$/g, "")}*`);
  }

  return blocks.join("\n\n");
}

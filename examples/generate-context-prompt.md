# Prompt: generate a Content Studio context file from your site's code

Open a coding agent (Claude Code, Cursor, Copilot) **in your website's repository**, then paste everything below the line. Replace `<CONTENT_STUDIO_DIR>` with the path to this Content Studio folder, so the agent can read the example file. If it can't reach that folder, the field list in the prompt is enough.

The agent writes `content-context.md` and suggests `.env` values. Review the file before using it: anything it couldn't confirm from the code is marked `TODO`.

---

```text
Create a brand context file for Content Studio, a tool that plans and writes blog posts for this website. Everything Content Studio knows about the brand comes from this one file, so it must be accurate. Base it ONLY on what you can find in this repository. Never invent features, prices, numbers, customers, testimonials or claims.

Template: <CONTENT_STUDIO_DIR>/examples/content-context.example.md. Read it first if you can, and match its format: Markdown with YAML frontmatter, then a free-form Markdown body.

1. RESEARCH THE CODEBASE
- Marketing copy: the home page, feature/product pages, pricing, about, FAQ, footer, and meta titles/descriptions (layouts, SEO config, page metadata).
- What the product actually does: routes, components and API endpoints that implement features. Prefer what the code does over what the copy promises.
- Limits and things it does NOT do: disclaimers, terms, FAQ answers, comments, feature flags that are off.
- Existing blog posts: find the folder posts are read from (content collections, CMS adapters, markdown loaders). Note the file extension, the frontmatter keys used, the URL path posts are served under, the categories and tags in use, and each post's slug and topic.
- Brand voice: tone of the existing copy and posts, words the brand uses or avoids, and any style or content guidelines (README, AGENTS.md, CLAUDE.md, docs/, CONTRIBUTING).
- Facts with sources: statistics, regulations, studies or standards that the site already cites. Keep the source exactly as the site names it.

2. WRITE content-context.md AT THE REPO ROOT
Use ONLY these frontmatter fields (unknown keys are rejected). Only `industry` and `summary` are required; leave out a field rather than guess.

- name: brand name.
- tagline: one line, from the site.
- industry: a short noun phrase for the field the brand works in (it becomes "an experienced practitioner in <industry>").
- summary: 1-2 sentences, what the business is and who it's for.
- audience: list of { name, needs }. Put the main reader first, phrased so "explaining this to <name>" reads naturally (lowercase, plural, e.g. "first-time home buyers").
- product.does: list of what the product really does, one feature per item, with the page URL if there is one.
- product.doesNot: list of things it does not do or must never be described as.
- product.pages: list of { url, label } for the key pages a post may link to (signup, pricing, free tools, product pages). Relative URLs.
- facts.allowed: list of { fact, source } the writer may use. Only facts already on the site or in the repo, with the source the site names. No source found = leave the fact out.
- facts.banned: list of claims the writer must never make (over-promises, guarantees, anything the terms or disclaimers rule out).
- links: list of { url, anchor, triggers } for internal linking, mostly from existing blog posts and key pages. triggers = 2-6 lowercase phrases a new post might naturally contain.
- cta: one sentence in Markdown with a link, used when a post has no internal links.
- categories: list of { name, keywords }. Use the category names existing posts already use; keywords are lowercase words that signal each category.
- defaultCategory: the most common or most general category.
- tags: the most common existing tags (up to 10).
- acronyms: acronyms in the field that should stay uppercase in tags.
- competitors: competitor names only if the site itself names them (comparison pages, "alternative to" copy).
- avoidTopics: topics the brand clearly doesn't cover or shouldn't write about.
- planning: optional extra guidance for planning new topics (seasonality, priority audiences, formats that work).
- outline: optional, ONLY if existing posts follow a clear repeated structure; list the sections between the opening answer and the FAQ.
- disclaimer: optional { text, triggers } if the site carries a disclaimer (legal, medical, financial, safety). text = the site's own wording; triggers = words that mean a post needs it.
- voiceExamples: optional, 2-3 { draft, rewrite } pairs: draft = a stiff, formal sentence about the topic; rewrite = the same fact in the brand's real voice, taken from or closely modelled on existing copy.
- frontmatter: ONLY if existing posts don't use the default keys (title, meta_title, description, date, updated, categories, tags, draft).
  - fields: map a default key to the key this site uses, or to false if the site doesn't use it (e.g. description: summary, meta_title: false).
  - extra: fixed keys every post needs (e.g. layout: post, author: "Team").

Body (after the closing ---): short sections with the brand's editorial rules: voice and tone, terminology, how to talk about pricing (e.g. "never quote prices, link to /pricing"), formatting habits of existing posts, anything the writer must always or never do.

Rules for the file:
- Valid YAML. Quote strings that contain a colon, #, or start with a quote or bracket.
- No em dashes.
- Where something is likely true but you couldn't confirm it in the code, add it as a YAML comment starting with "# TODO:" instead of a real value.

3. REPORT BACK
- The .env values for Content Studio:
  SITE_NAME=...
  SITE_URL=...           (production URL from config, env files or metadata)
  BLOG_PATH=...          (URL path posts are served under, e.g. /blog)
  CONTENT_OUTPUT_DIR=... (absolute path of the folder posts are read from)
  CONTENT_CONTEXT_FILE=... (absolute path of the file you wrote)
- Whether posts are .md (Content Studio reads and writes .md only).
- Every TODO you left, and anything in the code that contradicts the marketing copy.
```

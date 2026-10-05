# Content Studio

Suggests post ideas, writes them in a natural human voice, and saves them as markdown straight into your website's blog folder. Works with any site that keeps its posts as `.md` files.

## Quick start

**1. Run the app**

```bash
pnpm install
cp .env.example .env
pnpm dev --port 3005
```

**2. Fill in `.env`.** Where your posts are and where your context file will be:

```bash
CONTENT_DIR="../my-site/src/content/blog"
CONTEXT_FILE="../my-site/content-context.md"
```

**3. Describe your site.** Create that context file with:

```yaml
---
name: My Site
url: https://example.com
industry: home coffee brewing
summary: One or two sentences on what you offer and who it's for.
---
```

Open http://localhost:3005 and add a free [Groq API key](https://console.groq.com/keys) from the key button in the header. The app walks you through any step you missed.

## Get better posts

Those four lines are enough to start, but the writer only knows what the context file tells it. Add your audience, product facts (with sources), claims to avoid, internal links and categories:

- **Write it yourself:** copy fields from [`examples/content-context.example.md`](examples/content-context.example.md). Every field is explained there.
- **Let a coding agent write it:** open Claude Code, Cursor or Copilot in your site's repo and paste [`examples/generate-context-prompt.md`](examples/generate-context-prompt.md). It reads your pages and existing posts, writes the file, and marks anything it couldn't confirm with `# TODO:`.

Edits to the context file show up on the next page load.

## Pages

- **Dashboard** (`/`): posts published, the last post date, ideas waiting, posts needing cleanup, the next ideas to write, recent posts and (with Search Console) clicks and top posts.
- **Ideas** (`/ideas`): post ideas, highest estimated impact first. "Add 6 ideas" asks the AI for new ones; "Write" drafts one; an idea disappears once its post exists.
- **Write** (`/write`): draft a post from any title, ask for revisions, then save it to `CONTENT_DIR`.
- **Posts** (`/posts`): your posts, with Google stats and a "Clean up" button on posts with em-dashes, AI clichés or uniform sentence length. Clean up fixes words and dashes, then checks the post again and rewrites it (up to 3 tries) while something still fails. It tells you before and after saving whether the post passes.

---

## Reference

### Where things live

| What | Where |
| --- | --- |
| Posts | `CONTENT_DIR`, as `<slug>.md` (files starting with `_` are skipped) |
| Context file | `CONTEXT_FILE`; if empty, the nearest `content-context.md` in `CONTENT_DIR` or a folder above it, else `./content-context.md` in this app |
| Saved ideas | `content-ideas.json` next to the context file |
| Post URL path | `"/"` + the `CONTENT_DIR` folder name (`.../content/blog` → `/blog`); override with `blogPath` in the context file |

Keep the context file in each site's repo so every site carries its own brand notes and ideas; switching sites means changing the `.env` lines.

### Optional `.env` settings

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq key, instead of adding it in the browser |
| `CONTEXT_FILE` | Path to the context file (found automatically when empty) |
| `DRAFT_MODEL`, `FAST_MODEL`, `REWRITE_MODELS` | Override the Groq models |
| `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` | Google Search Console stats (see below) |
| `GSC_SITE_URL` | Only if your Search Console property isn't registered under the context file's `url` |
| `ORIGINALITY_API_KEY` | Scan drafts on Originality.ai and re-humanize ones scoring 50%+ AI |

### Context file fields

Markdown with YAML frontmatter. The Markdown body is free-form guidance (voice, pricing rules, terminology) added to every writing prompt.

| Field | Purpose |
| --- | --- |
| `name`, `url`, `industry`, `summary` | **Required.** Site name, public URL, your field, what you offer |
| `tagline`, `blogPath` | One-line tagline; post URL path override |
| `audience` | Who reads the blog (the first entry is the main reader) |
| `product.does`, `product.doesNot`, `product.pages` | What you offer, what you must never claim, pages posts may link to |
| `facts.allowed`, `facts.banned` | Facts the writer may use (with sources), claims it must never make |
| `links`, `cta` | Automatic internal links (url, anchor, trigger phrases); fallback call to action |
| `categories`, `defaultCategory`, `tags`, `acronyms` | Post metadata |
| `allowedWords` | Real terms in your field the AI-word check shouldn't flag (e.g. `robust`) |
| `competitors`, `avoidTopics`, `planning`, `outline` | Idea suggestions and article structure |
| `disclaimer`, `voiceExamples`, `frontmatter` | Disclaimer with trigger words, voice examples, output frontmatter keys |

### Output format

Posts are saved with this frontmatter:

```yaml
---
title: "How to Tell If Your Plant Is Overwatered"
meta_title: "How to Tell If Your Plant Is Overwatered"
description: "Yellow leaves and soggy soil are the usual signs. Here's how to check the roots and what to change."
date: 2026-10-04T09:00:00.000Z
categories: ["Pests & Problems","Plant Care"]
tags: ["Overwatered Plant Signs","Root Rot"]
draft: false
---
```

`updated` is added only when a post has one. If your site uses different keys, rename or drop them in the context file (the Posts page reads them the same way):

```yaml
frontmatter:
  fields:
    description: summary   # write `summary:` instead of `description:`
    meta_title: false      # leave it out
  extra:
    layout: post           # added to every new post
```

### Google Search Console

1. In Google Cloud, enable the **Google Search Console API** and create a service account with a JSON key.
2. In Search Console, open your property, go to **Settings > Users and permissions**, and add the service account email as a Restricted user.
3. Set `GSC_CLIENT_EMAIL` and `GSC_PRIVATE_KEY` (the `private_key` value from the JSON) in `.env` and restart. The property is found from the context file's `url`.

### How posts are written

1. **Draft** (`seed-generator.ts`): a conversational, opinionated draft (temperature 0.9 with frequency/presence penalties) that answers the search query up front and ends with an FAQ.
2. **Spoken-voice rewrite** (`humanizer.ts`): each section is rewritten by Qwen (gpt-oss as fallback) in the voice of an experienced practitioner in your `industry`. Code and tables are locked, and a section is kept as-is if links or too much text go missing. `voiceExamples` teach it your voice.
3. **Imperfection passes** (`imperfection-passes.ts`): content-hub's fillers, starters, punctuation variety and asides, placed only where they stay grammatical (no names lowercased, no doubled openers) and each phrase used once per post.
4. **Cleanup** (`content-humanizer.ts`): contractions, AI-tell word swaps, plain typography.
5. **Optional AI check** (`ai-detector.ts`): with `ORIGINALITY_API_KEY`, drafts scoring 50%+ AI are re-humanized up to twice and the best version is kept.

There's no named author, no invented stories and no fake trust signals. Numbers must come with a source, and the context file's fact rules apply to every prompt. Read every draft before publishing.

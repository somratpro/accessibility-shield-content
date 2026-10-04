# Content Studio

Plans, writes, humanizes and publishes markdown blog posts for any website. Brand knowledge comes from one context file; paths, URLs and keys come from `.env`.

## Setup

```bash
pnpm install
cp .env.example .env
cp examples/content-context.example.md content-context.md
pnpm dev --port 3005
```

1. In `.env`, set `SITE_NAME`, `SITE_URL`, `BLOG_PATH`, `CONTENT_OUTPUT_DIR` (the folder your site reads posts from) and `CONTENT_CONTEXT_FILE`.
2. Rewrite `content-context.md` for your brand: what you sell and don't, who reads the blog, facts the writer may use (with sources), claims it must never make, internal links and categories. Every field is explained in the example. To draft it from your site's code instead, see [Generate the context file from your site](#generate-the-context-file-from-your-site).
3. Add a Groq API key in `.env` (`GROQ_API_KEY=gsk_...`) or from the key button in the header.

If something is missing or invalid, the app shows a setup screen listing what to fix. Restart the dev server after editing `.env`; context file edits apply on the next page load.

## Generate the context file from your site

[`examples/generate-context-prompt.md`](examples/generate-context-prompt.md) is a prompt for a coding agent (Claude Code, Cursor, Copilot) opened in your website's repository. The agent reads your pages, product code and existing posts, then:

- writes `content-context.md`, using only facts it found in the code and marking anything it couldn't confirm with `# TODO:`,
- picks up your posts' categories, tags, frontmatter keys and internal links,
- reports the `.env` values (`SITE_URL`, `BLOG_PATH`, `CONTENT_OUTPUT_DIR`, `CONTENT_CONTEXT_FILE`).

Review the file, resolve the TODOs, point `CONTENT_CONTEXT_FILE` at it and reload the studio. If a field is wrong, the setup screen says which one.

## What goes where

| `.env` (wiring and secrets) | Context file (brand knowledge) |
| --- | --- |
| `GROQ_API_KEY` | `name`, `tagline`, `industry`, `summary` |
| `CONTENT_CONTEXT_FILE` | `audience` (first entry is the main reader) |
| `SITE_NAME`, `SITE_URL`, `BLOG_PATH` | `product.does`, `product.doesNot`, `product.pages` |
| `CONTENT_OUTPUT_DIR` | `facts.allowed` (with sources), `facts.banned` |
| `CALENDAR_FILE` (default `./data/content-calendar.json`) | `links` (url, anchor, triggers) and fallback `cta` |
| `DRAFT_MODEL`, `FAST_MODEL`, `REWRITE_MODELS` (optional) | `categories`, `defaultCategory`, `tags`, `acronyms` |
| `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL` (optional) | `competitors`, `avoidTopics`, `planning`, `outline` |
| `ORIGINALITY_API_KEY` (optional) | `disclaimer` (text + trigger words), `voiceExamples`, `frontmatter` |

The context file is Markdown with YAML frontmatter. The frontmatter holds the fields above; the Markdown body is free-form guidance (voice, pricing rules, terminology) added to every writing prompt.

## Pages

- **Calendar** (`/`): unpublished topics from `CALENDAR_FILE`, by date, each with an estimated impact (from search intent and urgency) and the reason it's worth writing. "Write" opens `/write` and drafts the post with the planned title, slug and keywords. "Add 6 ideas" adds 6 new ideas after the current plan, skipping anything already published or planned. A topic disappears once a post with its slug exists in `CONTENT_OUTPUT_DIR`. The calendar starts empty.
- **Write** (`/write`): generate a post from any title, review it, ask for revisions, then save it to `CONTENT_OUTPUT_DIR`.
- **Posts** (`/posts`): posts in `CONTENT_OUTPUT_DIR` with Google clicks, impressions and average rank for the last 28 days (once Search Console is connected), plus a "Clean up" button on any post with em-dashes, AI clichés or uniform sentence length.

## Output format

Posts are saved as `<slug>.md` with this frontmatter by default:

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

`updated` is written only when a post has one. To match another site generator, rename or drop keys and add fixed ones in the context file:

```yaml
frontmatter:
  fields:
    description: summary   # write `summary:` instead of `description:`
    meta_title: false      # leave it out
  extra:
    layout: post           # added to every new post
```

The Posts page reads posts with the same key names.

## Connect Google Search Console (optional)

1. In Google Cloud, create a project, enable the **Google Search Console API**, and create a service account with a JSON key.
2. In Search Console, open your property, go to **Settings > Users and permissions**, and add the service account email as a Restricted user.
3. Set `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` (the `private_key` value from the JSON) and `GSC_SITE_URL` (`sc-domain:example.com` for a domain property) in `.env`, then restart the dev server. Pages are matched by `BLOG_PATH`.

## Humanizer

Modelled on content-hub's generator, without its author-persona system (no named author, no invented stories, no fake trust signals):

1. **Draft** (`seed-generator.ts`): conversational, opinionated voice at temperature 0.9 with frequency/presence penalties, like content-hub.
2. **Spoken-voice rewrite** (`humanizer.ts`): each section is rewritten by Qwen (gpt-oss as fallback, see `REWRITE_MODELS`) in the casual voice of an experienced practitioner in the context's `industry`. Code and tables are locked; a section is kept as-is if links, placeholders or too much text go missing. `voiceExamples` in the context file teach it your voice; without them it uses neutral examples.
3. **Imperfection passes** (`imperfection-passes.ts`): content-hub's passes and rates (fillers, starters, punctuation variety, transitions, rhetorical questions, asides), with punctuation and markdown kept intact.
4. **Cleanup** (`content-humanizer.ts`): contractions, AI-tell word swaps, plain typography.
5. **Optional AI check** (`ai-detector.ts`): with `ORIGINALITY_API_KEY` set, drafts scoring 50%+ AI on Originality.ai are re-humanized up to twice and the best version is kept (content-hub's loop).

## Content rules

Prompts are built from the context file in `src/lib/brand-prompt.ts` and `src/lib/ai/seed-generator.ts`. Generated posts must answer the search query up front, end with an FAQ, cite sources for numbers, never invent stories or stats, and follow the context file's fact rules. Read every draft before publishing.

# MDGraph

Local-first Markdown knowledge graph for AI agents.

MDGraph treats Markdown files as the source of truth and keeps a disposable SQLite/FTS5 index under `.mdgraph/` for fast search, metadata lookup, graph extraction, watch mode, and MCP access.

## Features

- Index Markdown and MDX files from a vault directory
- Parse frontmatter, tags, aliases, dates, and wiki/Markdown links
- Search notes with SQLite FTS5 trigram search
- Extract Markdown heading outlines and include them in read/search results
- Watch vault changes and keep the index fresh
- Ignore templates and user-configured paths with `.mdgraphignore`
- Expose notes through an MCP server for AI agents
- Create and update notes while preserving Markdown as the truth source
- Rebuild incompatible SQLite indexes automatically from Markdown

## Install

```bash
pnpm install
pnpm build
```

Node.js `>=20` is required.

## CLI

Run from a Markdown vault, or pass `--vault <path>`.

```bash
pnpm dev -- init
pnpm dev -- sync
pnpm dev -- status
pnpm dev -- search "query" --limit 10 --tag project
pnpm dev -- get <note-id>
pnpm dev -- watch
pnpm dev -- mcp
```

After building, the CLI entry is `dist/cli.js` and the binary name is `mdgraph`.

## MCP tools

The MCP server exposes:

- `mdgraph_status`
- `mdgraph_search`
- `mdgraph_get_note`
- `mdgraph_get_graph`
- `mdgraph_sync`
- `mdgraph_create_note`
- `mdgraph_update_note`

`mdgraph_search` returns metadata, a highlighted snippet, the note `outline` extracted from Markdown headings, and a compact graph summary with link counts and previews. `mdgraph_get_note` returns the full cached body, the same `outline`, and bounded 1-hop graph context: outlinks, backlinks, broken links, ambiguous links, and total counts.

`mdgraph_get_graph` returns a configurable linked-note graph around a root note. It supports `depth`, `direction` (`out`, `back`, or `both`), and `maxNodes`.

`mdgraph_create_note` refuses to overwrite existing files. `mdgraph_update_note` updates the Markdown file first, then refreshes the SQLite index.

## Data model

Markdown is authoritative. SQLite is a cache.

- Markdown files live in the vault.
- The local index lives in `.mdgraph/mdgraph.db`.
- If the SQLite schema is incompatible, MDGraph can discard and rebuild the index from Markdown.
- Do not put irreplaceable user data only in SQLite unless a real migration path exists.

## Frontmatter example

```markdown
---
id: project_alpha
title: Project Alpha
type: project
status: active
tags: [work, research]
aliases: [Alpha]
created: 2026-05-31
updated: 2026-05-31
---

Body text with a [[Wiki Link]] and [Markdown link](other.md).
```

If `id` is missing, MDGraph derives one from the relative file path.

## Ignore rules

MDGraph ignores these paths by default:

- `**/.git/**`
- `**/.mdgraph/**`
- `**/node_modules/**`
- `**/dist/**`
- `**/_template.md`

Add custom vault-local ignore rules in `.mdgraphignore`:

```gitignore
# One glob per line. Empty lines and comments are skipped.
drafts/**
private/**
*.generated.md
```

`sync` applies the latest `.mdgraphignore` rules and marks previously indexed ignored files as deleted. `watch` and the MCP server load ignore rules when they start; restart the watcher/MCP server after changing `.mdgraphignore`.

## Development

```bash
pnpm test
pnpm check
pnpm build
```

Core source files:

- `src/cli.ts` — CLI commands
- `src/db.ts` — SQLite schema, version checks, queries
- `src/indexer.ts` — vault scan and per-file indexing
- `src/ignore.ts` — built-in and `.mdgraphignore` rules
- `src/parser.ts` — Markdown/frontmatter/link parsing
- `src/watcher.ts` — chokidar integration
- `src/mcp.ts` — MCP tools

## Git ignore notes

The generated SQLite index and local report output are ignored:

- `.mdgraph/`
- `html/`

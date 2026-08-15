# MDGraph Workflow

## CLI Commands

```bash
pnpm dev --vault "<path-to-vault>" sync
pnpm dev --vault "<path-to-vault>" status
pnpm dev --vault "<path-to-vault>" search mdgraph
pnpm dev --vault "<path-to-vault>" get mdgraph
pnpm dev --vault "<path-to-vault>" watch
```

## MCP Tools

OpenCode starts MDGraph as an MCP server. Available tools:

```
mdgraph_status         — index health, tag distribution
mdgraph_search         — full-text search (query, limit, tag?, type?, status?)
mdgraph_get_note       — get full note body + outline + 1-hop graph
mdgraph_get_graph      — configurable graph around a root note
mdgraph_sync           — force re-index after bulk changes
mdgraph_suggest_tags   — deterministic tag suggestions for a note
mdgraph_create_note    — create Markdown and index (won't overwrite)
mdgraph_update_note    — update Markdown and reindex
mdgraph_explore_notes  — question-oriented context: full answer notes + pointers + session dedup
```

Tool choice: use `mdgraph_explore_notes` when starting from a question/topic (it returns ready-to-use context and won't repeat content already served in the session); use `mdgraph_search` for precise lookups by title/tag/id or when you need raw ranked results.

If a note was just created outside the agent and search results look stale, call `mdgraph_sync` once (normally unnecessary — the watcher syncs changed files within a second via precise-path scoped sync).

## .mdgraphignore

Vault root ignore file at `<vault>/.mdgraphignore`:

```gitignore
# One glob per line. Empty lines and comments are skipped.
**/_template.md
.obsidian/**
.trash/**
```

`sync` applies the latest ignore rules and marks previously indexed ignored files as deleted. `watch` and MCP server load ignore rules at startup; restart OpenCode/MCP after changing `.mdgraphignore` if watcher behavior needs to change immediately.

## Creating Notes Safely

1. Choose the correct folder from folder-rules.
2. Apply the naming rule for that folder.
3. Check whether a similar note already exists via `mdgraph_search` when possible.
4. Use stable frontmatter with a stable `id`.
5. Write Markdown first; let MDGraph index it afterward (`mdgraph_create_note` or direct file write + `mdgraph_sync`).

For timestamped names, use current local date/time:

```
yyyymmdd_hhmmss_short-kebab-name.md
```

## Updating Notes Safely

- Keep the existing `id` unless the user explicitly requests an ID migration.
- Update the `updated` date.
- Preserve all existing sections unless the user asks to remove or restructure them; append new material under the most relevant existing heading.
- Avoid broad reorganizations unless requested.
- If the update comes from a coding session, append one dated bullet containing: decision/change, evidence link, and current status.
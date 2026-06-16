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
mdgraph_status       — index health, tag distribution
mdgraph_search       — full-text search (query, limit, tag?, type?, status?)
mdgraph_get_note     — get full note body + outline + 1-hop graph
mdgraph_get_graph    — configurable graph around a root note
mdgraph_sync         — force re-index after bulk changes
mdgraph_create_note  — create Markdown and index (won't overwrite)
mdgraph_update_note  — update Markdown and reindex
```

If a note was just created outside the agent and search results look stale, call `mdgraph_sync` once.

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
- Preserve useful existing sections; append or revise only what is needed.
- Avoid broad reorganizations unless requested.
- If the update comes from a coding session, prefer adding a short decision/progress entry rather than rewriting the entire note.
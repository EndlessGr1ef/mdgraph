# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project principles

- Markdown files are the source of truth.
- SQLite is a disposable, rebuildable index/cache.
- Prefer simple, direct code over speculative abstractions.
- Keep changes tightly scoped to the requested behavior.
- Code and comments should be in English.

## Validation

Run these before committing code changes:

```bash
pnpm test
pnpm check
pnpm build
```

## Architecture map

- `src/cli.ts` wires CLI commands to the core modules.
- `src/db.ts` owns SQLite schema, schema version checks, upserts, search, and status queries.
- `src/indexer.ts` scans Markdown files, indexes/removes individual files, and reconciles precise changed-path sets (`syncChangedFiles`), skipping unchanged files via (size, mtime) pre-filter with content-hash confirmation.
- `src/parser.ts` parses frontmatter, body text, tags, aliases, dates, and links.
- `src/watcher.ts` batches vault change events with an adaptive debounce window and flushes precise paths to scoped sync; directory events and overflows fall back to a full sync.
- `src/explore.ts` builds question-oriented exploration results with session-level dedup and pointer output.
- `src/mcp.ts` exposes MCP tools for search, read, graph, sync, suggest_tags, create, update, and explore.
- `src/paths.ts` centralizes vault-relative path handling and path escape checks.

## Data safety rules

- Do not treat SQLite rows as authoritative user data.
- For note creation and updates, write Markdown first and refresh the index second.
- Never allow writes outside the vault root.
- Do not overwrite existing Markdown files unless the operation is explicitly an update of that note.
- If a schema is incompatible, rebuilding the SQLite index is acceptable because Markdown can recreate it.

## Testing expectations

When changing indexing, DB, MCP write behavior, or watcher behavior, add or update tests in `src/__tests__/`.

Important behaviors already covered:

- Frontmatter `id` changes clean up stale index rows.
- Duplicate note IDs are reported instead of silently overwritten.
- Deleted notes do not pollute search or top-tag statistics.
- Bad Markdown/frontmatter does not block the whole vault sync.
- MCP create refuses overwrites.
- MCP update rewrites Markdown and refreshes the index.
- Watch mode works even when the current working directory is outside the vault.
- Compatible pre-version DBs are stamped; incompatible DBs are rebuilt.
- Notes are searchable by filename even when a frontmatter title is set (path is indexed in FTS).
- Short CJK queries (1–2 chars) fall back to LIKE substring search, and full-width query characters are normalized.
- Inline `#tags` in the body are merged into indexed tags (code blocks ignored); note creation derives tags deterministically when none are provided.
- Watch mode batches events and syncs only the changed paths; directory events and >500 pending paths fall back to a full sync.
- Unchanged files are not re-parsed (stat pre-filter + content-hash confirmation); orphan rows for deleted paths are removed in scoped sync.
- Scoped sync rejects paths outside the vault root and paths matched by ignore rules.
- An unmet full-scan demand survives an in-flight flush (scheduling decisions are pure functions under test).
- `mdgraph_explore_notes` pointerizes only byte-identical already-served notes, re-serves edited ones, and its session store is bounded.

## Git hygiene

- Commit messages should use Conventional Commits.
- Do not commit `.mdgraph/*.db`, WAL/SHM files, generated `dist/`, or files under `html/`.
- Do not include AI signatures in commits.
- To persist conversation summaries, prefer calling mdgraph MCP to write to the corresponding Markdown node.

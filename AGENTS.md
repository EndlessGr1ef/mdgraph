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
- `src/indexer.ts` scans Markdown files and indexes/removes individual files.
- `src/parser.ts` parses frontmatter, body text, tags, aliases, dates, and links.
- `src/watcher.ts` watches vault changes and calls the indexer.
- `src/mcp.ts` exposes MCP tools for search, read, sync, create, and update.
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

## Git hygiene

- Commit messages should use Conventional Commits.
- Do not commit `.mdgraph/*.db`, WAL/SHM files, generated `dist/`, or files under `html/`.
- Do not include AI signatures in commits.

## Magic Context and mdgraph coexistence rules

This project uses both Magic Context and mdgraph MCP.

- mdgraph is the single source of truth for project tasks, requirements, decisions, plans, and status.
- Magic Context is only for session context compression, history recall, and auxiliary memory.
- When Magic Context recalled information conflicts with mdgraph, mdgraph takes precedence.
- Any task status change, requirement confirmation, architecture decision, TODO, milestone, or bug conclusion must be written to mdgraph.
- Do not treat Magic Context project memory as the final project status.
- Do not let Magic Context or dreamer automatically maintain Markdown files managed by mdgraph.
- To persist conversation summaries, prefer calling mdgraph MCP to write to the corresponding Markdown node.

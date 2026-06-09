---
name: knowledge-vault
description: Use this skill whenever the user mentions KnowledgeVault, local knowledge vaults, mdgraph memory, AI memory, agent task records, research notes, vault organization, note templates, or asks to create/search/update/archive notes in a Markdown vault. This skill defines a local Markdown knowledge vault structure, naming rules, frontmatter conventions, and MDGraph usage workflow; use it proactively before writing or reorganizing any knowledge note.
---

# KnowledgeVault Usage and Writing Rules

Use this skill when working with a local Markdown knowledge vault. The vault is the long-term memory layer shared by AI agents. Markdown files are the durable source of truth; MDGraph's SQLite index is only a rebuildable cache.

## Vault location

Set the vault root with `--vault <path>` or by running MDGraph from the vault directory.

## Directory map

```text
00_inbox/       quick captures, rough notes, temporary ideas
10_agentTasks/  AI agent task records, handoffs, session summaries
20_research/    research notes, source summaries, investigations
30_knowledge/   evergreen knowledge, concepts, projects, people, tools
90_archive/     archived notes and completed material
```

Under `30_knowledge/`, use these common subfolders:

```text
30_knowledge/concepts/
30_knowledge/projects/
30_knowledge/people/
30_knowledge/tools/
```

## Naming rules

For these folders, new files and folders must use a timestamp prefix:

```text
00_inbox/
10_agentTasks/
20_research/
90_archive/
```

Allowed forms:

```text
yyyymmdd_hhmmss_name.md
yyyymmdd_hhmmss_name/
```

Examples:

```text
00_inbox/20260603_190500_quick-capture.md
10_agentTasks/20260603_191200_mdgraph-read-note/
20_research/20260603_192000_local-first-knowledge-graph.md
90_archive/20260603_193000_old-agent-task.md
```

For `30_knowledge/`, use stable semantic names for long-term linking:

```text
30_knowledge/concepts/local-first.md
30_knowledge/projects/mdgraph.md
30_knowledge/people/example-person.md
30_knowledge/tools/sqlite.md
```

## Frontmatter convention

Prefer structured frontmatter:

```yaml
---
id: stable-note-id
title: Human Readable Title
type: note
status: active
tags: []
aliases: []
created: 2026-06-03
updated: 2026-06-03
---
```

Use stable `id` values because MDGraph and agents use `id` for retrieval. Do not change an existing note's `id` casually; changing it breaks references unless links are updated deliberately.

Recommended `type` values:

```text
inbox
agent_task
research
research-archive
concept
project
person
tool
knowledge
archive
```

Recommended `status` values:

```text
raw
active
done
evergreen
archived
```

## Which folder to use

Choose the smallest appropriate home:

- Use `00_inbox/` for fast capture when the final home is unclear.
- Use `10_agentTasks/` for AI-agent task records, session handoffs, implementation logs, and decisions from coding sessions.
- Use `20_research/` for investigations, source summaries, video/article analysis, and notes that cite external material.
- Use `30_knowledge/` for durable concepts, project context, people, tools, and reusable evergreen knowledge.
- Use `90_archive/` for completed or obsolete material that should remain searchable but not active.

When unsure, capture in `00_inbox/` first rather than forcing a premature taxonomy.

## Writing guidelines

- Write concise Markdown with clear headings.
- Preserve user-owned content; do not overwrite existing Markdown unless the task is explicitly an update.
- Prefer wikilinks for relationships: `[[mdgraph]]`, `[[local-first]]`.
- Keep generated notes source-grounded. For research notes, include sources or enough provenance to recover them.
- Do not store secrets, API keys, credentials, private tokens, or sensitive personal data unless the user explicitly instructs and the storage location is appropriate.
- If creating an agent task record, include goal, context, decisions, progress, result, and follow-ups.

## Template files

Each major directory has a `_template.md`. Use it as a shape reference, but do not assume templates are user notes. MDGraph ignores `**/_template.md` by default, so templates should not appear in search or active note statistics.

Current template locations:

```text
00_inbox/_template.md
10_agentTasks/_template.md
20_research/_template.md
30_knowledge/_template.md
30_knowledge/concepts/_template.md
30_knowledge/projects/_template.md
30_knowledge/people/_template.md
30_knowledge/tools/_template.md
90_archive/_template.md
```

## MDGraph workflow

MDGraph repository:

```text
<path-to-mdgraph-repo>
```

Useful CLI commands:

```bash
pnpm dev --vault "<path-to-vault>" sync
pnpm dev --vault "<path-to-vault>" status
pnpm dev --vault "<path-to-vault>" search mdgraph
pnpm dev --vault "<path-to-vault>" get mdgraph
pnpm dev --vault "<path-to-vault>" watch
```

The vault also has a root ignore file:

```text
<path-to-vault>/.mdgraphignore
```

Use it for vault-local exclusions. Format:

```gitignore
# One glob per line. Empty lines and comments are skipped.
**/_template.md
.obsidian/**
.trash/**
```

`sync` applies the latest ignore rules and marks previously indexed ignored files as deleted. `watch` and the MCP server load ignore rules when they start; restart OpenCode/MCP after changing `.mdgraphignore` if watcher behavior needs to change immediately.

OpenCode is configured to start MDGraph as an MCP server. The MCP server does an initial full sync and then watches the vault for Markdown add/change/delete events. Use the MCP tools when available:

```text
mdgraph_status
mdgraph_search
mdgraph_get_note
mdgraph_get_graph
mdgraph_sync
mdgraph_create_note
mdgraph_update_note
```

If a note was just created outside the agent and search results look stale, call `mdgraph_sync` once or ask the user whether OpenCode has been restarted since the MCP configuration changed.

## Creating notes safely

Before creating a note:

1. Choose the correct folder from the directory map.
2. Apply the naming rule for that folder.
3. Check whether a similar note already exists via MDGraph search when possible.
4. Use stable frontmatter and a stable `id`.
5. Write Markdown first; let MDGraph index it afterward.

For timestamped names, use the current local date/time in this shape:

```text
yyyymmdd_hhmmss_short-kebab-name.md
```

Example research note path:

```text
20_research/20260603_192000_local-first-knowledge-graph.md
```

Example evergreen project note path:

```text
30_knowledge/projects/mdgraph.md
```

## Updating notes safely

When updating existing notes:

- Keep the existing `id` unless the user explicitly requests an ID migration.
- Update the `updated` date.
- Preserve useful existing sections; append or revise only what is needed.
- Avoid broad reorganizations unless requested.
- If the update comes from a coding session, prefer adding a short decision/progress entry rather than rewriting the entire note.

## Agent task note shape

For `10_agentTasks/`, use this structure when recording work:

```markdown
---
id: agent-task-short-id
title: Task Title
type: agent_task
status: active
tags: [agent-task]
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Task Title

## Goal

## Context

## Constraints

## Plan

## Progress

## Decisions

## Result

## Follow-ups
```

## Research note shape

For `20_research/`, prefer:

```markdown
---
id: research-short-id
title: Research Title
type: research
status: active
tags: [research]
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Research Title

## Question

## Sources

## Findings

## Claims

## Open Questions

## Related Notes
```

## Common pitfalls

- Do not put durable evergreen knowledge in `00_inbox/` forever; promote it to `30_knowledge/` once stable.
- Do not create untimestamped files in `00_inbox/`, `10_agentTasks/`, `20_research/`, or `90_archive/` except `_template.md`.
- Do not treat `.mdgraph/*.db` as authoritative data.
- Do not rely on template notes as real knowledge; templates are ignored by MDGraph indexing.
- Do not overwrite notes just because the generated title collides; search first and choose update vs new note deliberately.

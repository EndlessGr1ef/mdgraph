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
30_knowledge/   long-lived knowledge, concepts, projects, people, tools
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
description: One sentence summary
type: knowledge
status: active
tags: []
aliases: []
resource: Optional external URI or path
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Use stable `id` values because MDGraph and agents use `id` for retrieval. Do not change an existing note's `id` casually; changing it breaks references unless links are updated deliberately.
Use `description` for a compact one-sentence summary (recommended ≤ 80 characters) that can appear in search previews, generated indexes, and agent context. Use `resource` when a note describes a canonical external asset, such as a GitHub repository, local project path, API endpoint, documentation page, dashboard, paper, or website. Omit the `resource` field entirely for purely abstract notes rather than leaving it blank.
Choose `type` from the role/category values below; choose `status` from the lifecycle values below.

Recommended `type` values (role/category only; never lifecycle):

```text
inbox
agent_task
research
concept
project
person
tool
knowledge
```

Recommended `status` values (lifecycle only):

```text
draft        # just captured, not yet organized
active       # in use, maintained
in_progress  # actively being implemented
review       # waiting for review
done         # finished, no longer actively updated
archived     # archived, no longer active
```

`type` expresses the note's role or category. `status` expresses its lifecycle state. Do not encode lifecycle into `type` — for example, use `type: research` + `status: archived` instead of `type: research-archive`. Use `tags: [evergreen]` for timeless content instead of `status: evergreen`.
`inbox` means capture-bucket role; use `status: draft` for unorganized lifecycle state.

### OKF-inspired conventions

KnowledgeVault borrows a few lightweight ideas from Open Knowledge Format (OKF) while keeping Markdown as the source of truth and MDGraph's SQLite index as a rebuildable cache.

- Treat each Markdown file as one knowledge concept/note.
- Keep `type` non-empty on all real notes. MDGraph can fall back to `note`, but producers should write explicit types — do not rely on the fallback.
- Prefer `description` for one-sentence summaries.
- Prefer `resource` when a note is anchored to an external or canonical asset.
- Unknown frontmatter keys are allowed; preserve them when updating notes.
- Broken links are warnings, not hard failures. They may represent planned or not-yet-written knowledge.

Use conventional sections when they fit the note. These are guidance, not hard requirements:

```text
## Summary / ## 一句话总结
## Context / ## 背景
## Examples / ## 示例
## Sources / ## 来源
## Citations / ## 引用
## Related Notes / ## 相关笔记
```

For research notes, prefer `## Sources` for source list and `## Citations` only when citing specific claims. For durable knowledge notes, prefer `## Related Notes` for internal wikilinks.

## Which folder to use

Choose the smallest appropriate home:

- Use `00_inbox/` for fast capture when the final home is unclear.
- Use `10_agentTasks/` for AI-agent task records, session handoffs, implementation logs, and decisions from coding sessions.
- Use `20_research/` for investigations, source summaries, video/article analysis, and notes that cite external material.
- Use `30_knowledge/` for durable concepts, project context, people, tools, and reusable long-lived knowledge; add `tags: [evergreen]` when the content is timeless.
- Use `90_archive/` for completed or obsolete material that should remain searchable but not active; keep the original role/category `type` and use `status: archived` for lifecycle.

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

Example long-lived project note path:

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

## Agent task workflow

Use this workflow whenever the user asks to create an agent task, start a tracked agent workflow, preserve a coding session, or make work resumable across agents.

The agent task record is the canonical source of truth. Planning files are subordinate working files and must be discoverable from the agent task record.

### Creation rule

Create one timestamped folder under `10_agentTasks/`:

```text
10_agentTasks/yyyymmdd_hhmmss_short-kebab-name/
```

Inside that folder, create the canonical task record using the task slug without the timestamp:

```text
short-kebab-name.md
```

Example:

```text
10_agentTasks/20260611_153000_fix-panel-drift/
├── fix-panel-drift.md
├── task_plan.md
├── findings.md
└── progress.md
```

Prefer this folder + task-named Markdown file form for new tasks, even if older records used a single `.md` file or a generic task file name. Do not rename old task records unless the user asks.

### Canonical task shape

For `10_agentTasks/yyyymmdd_hhmmss_short-kebab-name/short-kebab-name.md`, use this structure when recording work:

```markdown
---
id: 10_agenttasks_yyyymmdd_hhmmss_short-kebab-name
title: Task Title
type: agent_task
status: in_progress
tags:
  - agent-task
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

Use `status: done` when the task is complete; use `status: archived` only when the record is historical and no longer active.

### When to create planning files

Create colocated planning files only when the task needs durable planning. Use them if any condition is true:

- The task has 3+ distinct steps.
- The task needs cross-session recovery.
- The task involves multiple agents, repositories, or file areas.
- The task includes research, implementation, validation, or decisions worth preserving.
- The user explicitly asks to plan, split, organize, track, or resume work.

If none of these apply, keep only the task-named canonical Markdown file and briefly state in `## Plan` why planning files were skipped.

### Colocated planning files

When planning files are needed, apply the available planning skill whose name starts with `planning-with-files` — for example, `planning-with-files` or `planning-with-files-zh` — and create these files in the same task folder as the canonical task file:

```text
task_plan.md
findings.md
progress.md
```

For this agent task workflow, the task folder overrides the selected `planning-with-files*` variant's default project-root placement. Do not place these planning files in the current code project root unless the user explicitly asks.

In the canonical task file, index the planning files with relative links:

```markdown
## Context

Related planning files in this task folder:

- `task_plan.md`
- `findings.md`
- `progress.md`

## Plan

See `./task_plan.md`.

## Progress

See `./progress.md`.
```

Use Chinese prose for the task record when the surrounding workflow is Chinese; keep paths, identifiers, commands, and code terms unchanged.

### Resume rule

When resuming an agent task, read the task-named canonical Markdown file first. Then follow its links to `task_plan.md`, `findings.md`, and `progress.md` if they exist. Treat conflicts as follows:

1. The task-named canonical Markdown file is the authoritative index and summary.
2. `task_plan.md` owns phase-level planning and status.
3. `findings.md` owns research notes, evidence, and investigation details.
4. `progress.md` owns chronological session logs and validation results.

If files disagree, preserve evidence in subordinate files but update the canonical task file so the next agent has a correct entry point.

### OpenCode shortcut

OpenCode may provide a `/agent-task` command that starts this workflow. The command is only a shortcut; this skill remains the durable workflow definition. If a user asks for an agent task without using `/agent-task`, still follow the same rules.

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

Use `status: in_progress` for ongoing investigations; use `status: active` for maintained reference notes.

## Common pitfalls

- Do not put durable long-lived knowledge in `00_inbox/` forever; promote it to `30_knowledge/` once stable and add `tags: [evergreen]` when appropriate.
- Do not create untimestamped files in `00_inbox/`, `10_agentTasks/`, `20_research/`, or `90_archive/` except `_template.md`.
- Do not treat `.mdgraph/*.db` as authoritative data.
- Do not rely on template notes as real knowledge; templates are ignored by MDGraph indexing.
- Do not overwrite notes just because the generated title collides; search first and choose update vs new note deliberately.

# Engineering Workflow Phases

6-phase framework for daily engineering work (investigation, migration, implementation). Inspired by Matt Pocock's model, restructured with knowledge sinking as a conditional phase and adapted for orchestrator + planning-with-files workflow.

## The 6 Phases

```text
Brief → Research? → Plan → Implement → Verify → Sink?
(Frame)  (Explore)  (Plan) (Do)      (Check)  (Crystallize)
```

Research and Sink are marked with `?` because they are optional/conditional — Research can be skipped if the user already has evidence; Sink only runs when durable knowledge was produced.

| Phase | Command | Purpose | Key Tool | Deliverable |
|-------|---------|---------|----------|-------------|
| 1. Brief | `/phase-brief` | Create/confirm task brief, create task note cluster | `socratic-question` or inline framing fallback; `mdgraph_create_note` | Problem statement + mdgraph task note cluster (4 notes) |
| 2. Research | `/phase-research` | Gather evidence (optional, skippable) | `codegraph` + `tavily` + `mdgraph_search` + `mdgraph_get_graph` | Findings note via `mdgraph_update_note` |
| 3. Plan | `/phase-plan` | Build work graph / lanes / dependencies / verification criteria | Direct planning; `planning-with-files` optional; `mdgraph_update_note` | Plan note via `mdgraph_update_note` |
| 4. Implement | `/phase-implement` | Dispatch specialist lanes, implement, reconcile | `deepwork` or direct; `mdgraph_update_note` for progress | Code changes + progress note updates |
| 5. Verify | `/phase-verify` | Run checks/review gates, loop on failure | Direct checklist; external reviewer optional; `mdgraph_update_note` | Verification report in progress note; task status → `review` |
| 6. Sink | `/phase-sink` | Crystallize knowledge to vault (optional/conditional) | `mdgraph_create_note` + `mdgraph_update_note` for bidirectional links | Vault note(s) with bidirectional wikilinks or "no durable knowledge" |

## Agent Task Creation (Phase 1)

Create one timestamped folder under `10_tasks/`:

```
10_tasks/yyyymmdd_hhmmss_short-kebab-name/
```

Inside, create the canonical task record using the task slug without timestamp:

```
short-kebab-name.md
```

Example:

```
10_tasks/20260611_153000_fix-panel-drift/
├── fix-panel-drift.md
├── plan.md
├── findings.md
└── progress.md
```

### mdgraph Note Cluster

Each task folder contains 4 mdgraph-indexed notes connected by wikilinks:

- **Task note** (spine): `{slug}.md` — type: `agent_task`, status: `in_progress`
  - The entry point for graph traversal
  - Contains Goal, Scope, Phase Progress, Decisions, Result
- **Findings note**: `findings.md` — type: `research`, status: `active`
  - Contains `Task: [[task-id]]` wikilink back to spine
- **Plan note**: `plan.md` — type: `agent_task`, status: `active`
  - Contains `Task: [[task-id]]` wikilink back to spine
- **Progress note**: `progress.md` — type: `agent_task`, status: `active`
  - Contains `Task: [[task-id]]` wikilink back to spine

Create all 4 notes via `mdgraph_create_note` in the Brief phase. Update them via `mdgraph_update_note` in subsequent phases. The task note's `aliases` field should include the slug for short-form wikilink resolution (e.g., `[[fix-panel-drift]]`).

### Canonical Task Shape

```markdown
---
id: 10_tasks_yyyymmdd_hhmmss_short-kebab-name
title: Task Title
type: agent_task
status: in_progress
tags: [agent-task]
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Task Title

## Goal

## Scope

## Context

Findings: [[{findings-note-id}]]
Plan: [[{plan-note-id}]]
Progress: [[{progress-note-id}]]

## Constraints

## Success Criteria

## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Brief | ✅ done | YYYY-MM-DD |
| Research | ⬜ pending / N/A | - |
| Plan | ⬜ pending / N/A | - |
| Implement | ⬜ pending / N/A | - |
| Verify | ⬜ pending | - |
| Sink | ⬜ pending / N/A | - |

## Progress

## Decisions

## Result

Knowledge crystallized: [[{knowledge-note-id}]]

## Follow-ups
```

Use `status: done` when complete, `status: cancelled` when intentionally stopped before completion, and `status: archived` only when historical and no longer active.

`## Phase Progress` is workflow state. Generic formatters must not infer, reorder, or overwrite existing status values. At most, tooling may insert this template when the section is missing; phase commands own status updates.

### When to Create the Note Cluster

Always create all 4 notes in the cluster (task, findings, plan, progress) regardless of task complexity. The overhead of 3 extra `mdgraph_create_note` calls is negligible compared to the graph connectivity gained.

If mdgraph MCP is unavailable, fall back to direct file writes and call `mdgraph_sync` when available.

### Note Cluster Rules

Each note in the cluster is an independent mdgraph node with its own id, type, status, and tags:

- Deliverable notes (findings, plan, progress) always contain `Task: [[task-id]]` as their first content line
- The task note links to all deliverables in `## Context` via wikilinks
- Phase transitions update the task note via `mdgraph_update_note` (Phase Progress + status field)
- The task note's `aliases` field includes the slug for short-form wikilink resolution

Use `planning-with-files` if available for structured maintenance; otherwise update notes directly via `mdgraph_update_note`.

### Resume Rule

When resuming a task:

1. `mdgraph_get_note(id: task-id)` — returns note body + 1-hop graph context
2. Parse `## Phase Progress` from the note body to find the last completed phase
3. Follow `graph.outlinks` to reach deliverable note ids
4. `mdgraph_get_note(id: deliverable-id)` for each needed artifact
5. If mdgraph MCP is unavailable, read files directly from the vault path

Conflict resolution:
1. Task note = authoritative index and summary
2. Plan note = phase-level planning
3. Findings note = evidence and investigation
4. Progress note = chronological logs

If notes disagree, preserve evidence in subordinate notes but update the task note so the next agent has a correct entry point.

## Work Type Routing

Not all tasks need all 6 phases. After Brief, select the shortest path:

| Work type | Phase path |
|-----------|-----------|
| Investigation (bug/error/crash) | Brief → Research → Plan → Implement → Verify → Sink |
| Migration / parity check | Brief → Research → Plan → Implement → Verify → Sink |
| Feature implementation | Brief → Research → Plan → Implement → Verify → Sink |
| Code review / impact analysis | Brief → Research → Verify → Sink |
| Knowledge gap fill | Brief → Research → Sink |

Work type detection keywords should be defined in project-level `AGENTS.md`. Default to full 6-phase path when no keywords match.

Review and knowledge-gap paths do not enter Implement. Their Verify/Sink phases read the findings note, the task note `## Goal`, and any explicit review scope instead of requiring the plan note.

## Skill Prerequisites and Fallbacks

This workflow may benefit from external/global skills, but it must remain executable without them:

| Optional dependency | Used for | Fallback |
|---|---|---|
| `socratic-question` | Problem framing in Brief | Ask concise inline clarification questions, then write the same Problem Statement |
| `planning-with-files` | Structured plan, findings, progress note maintenance | Create and update those notes directly via `mdgraph_update_note` |
| `deepwork` | Complex/risky implementation sessions | Use the orchestrator's normal plan/delegate/verify workflow with explicit review gates |
| `adversarial-reviewer` | High-risk challenge review | Use the direct review checklist and route code review to an available reviewer/oracle when supported |

## Phase Transition

After each phase completes:

1. Update task note via `mdgraph_update_note`: update `## Phase Progress` (mark current phase ✅ done + date) and update `status` field when warranted. If mdgraph MCP is unavailable, write the file directly and call `mdgraph_sync` when available.
2. Find the next applicable phase (first `⬜ pending` after current; skip N/A phases)
3. Prompt user with next phase suggestion:

```text
✅ Research complete → next: /phase-plan (build task plan)
Proceed? [yes/skip/stop/abort]
```

Options:

- **yes**: enter next phase
- **skip**: only for skippable phases; mark as `⏭️ skipped`, advance
- **stop**: return to normal conversation (task stays `in_progress`)
- **abort**: `mdgraph_update_note(id: task-id, status: "cancelled")`, write brief reason to progress note

For mandatory phases (Plan, Implement, Verify), do NOT offer skip — only `yes/stop/abort`.

### Phase Progress Table

Initialize based on work type routing. Mark N/A phases upfront:

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Brief | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| Plan | ⬜ pending | - |
| Implement | ⬜ pending | - |
| Verify | ⬜ pending | - |
| Sink | ⬜ pending | - |
```

When resuming a task, read this table to determine current phase.

## Sink Rules (Phase 6)

Optional/conditional phase. Evaluate whether durable reusable knowledge was produced:

1. New reusable knowledge (concept/pattern/gotcha) → `30_knowledge/concepts/` or `30_knowledge/tools/` note
2. Investigation findings worth referencing → `20_research/` note using original task timestamp
3. Updated understanding of existing note → update via `mdgraph_update_note`
4. Always add `tags` including the project/context tag
5. Always include `Source: [[task-id]]` wikilink in the knowledge note content (this creates the bidirectional edge for graph traversal). Also add `source_task:` frontmatter field linking back to agent task folder path as a stable reference.
6. After creating the knowledge note, update the task note: `mdgraph_update_note(id: task-id, content: ...)` — add `## Result` section with `Knowledge crystallized: [[knowledge-note-id]]`. Then `mdgraph_update_note(id: task-id, status: "done")`.
7. If no durable knowledge was produced, record `"No durable knowledge produced"` in the progress note and skip writing
8. If MDGraph tools fail, write file directly and call `mdgraph_sync` when available
9. After writing, ask user: "Written to vault: [note path]. Is the content correct? Any adjustments needed?" Only mark Sink done after the user confirms, or after applying requested adjustments, or after recording the skip decision.

## Skip Conditions

| Phase | Can skip? | When |
|-------|-----------|------|
| Brief | No | Always needed |
| Research | Yes | User already has all evidence |
| Plan | No | Must plan before implementing (unless simple enough for direct execution) |
| Implement | No | This IS the work |
| Verify | No | Must verify before sinking |
| Sink | Yes | No durable knowledge was produced |

Plan can technically be collapsed into Implement for trivial tasks (1-2 lines, single file), but the phase table should still show it as skipped or handled.

## Socratic-Question Role

`socratic-question` serves one role in this framework:

- **Brief phase**: deconstruct the problem — "Is this a timeout or a hang? What is the blast radius?"

Do NOT use `grill-me` or `grill-with-docs` in this framework.

## OpenCode Shortcut

OpenCode loads the phase commands from `.opencode/commands/phase-*.md`. The command files are the executable prompts; this reference remains the durable workflow definition.

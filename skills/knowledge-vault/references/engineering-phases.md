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
| 1. Brief | `/phase-brief` | Create/confirm task brief, create task folder | `socratic-question` or inline framing fallback | Problem statement + agent task folder |
| 2. Research | `/phase-research` | Gather evidence (optional, skippable) | `codegraph` + `tavily` + `mdgraph_search` | `findings.md` |
| 3. Plan | `/phase-plan` | Build work graph / lanes / dependencies / verification criteria | Direct planning; `planning-with-files` optional | `task_plan.md` |
| 4. Implement | `/phase-implement` | Dispatch specialist lanes, implement, reconcile | `deepwork` or direct | Code changes |
| 5. Verify | `/phase-verify` | Run checks/review gates, loop on failure | Direct checklist; external reviewer optional | Verification report |
| 6. Sink | `/phase-sink` | Crystallize knowledge to vault (optional/conditional) | `mdgraph_create_note` | Vault note(s) or "no durable knowledge" |

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
├── task_plan.md
├── findings.md
└── progress.md
```

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

## Context

## Constraints

## Plan

## Progress

## Decisions

## Result

## Follow-ups
```

Use `status: done` when complete, `status: cancelled` when intentionally stopped before completion, and `status: archived` only when historical and no longer active.

### When to Create Planning Files

Create colocated `task_plan.md`, `findings.md`, `progress.md` when any condition is true:

- Task has 3+ distinct steps
- Task needs cross-session recovery
- Task involves multiple agents, repos, or file areas
- Task includes research, implementation, validation, or decisions worth preserving
- User explicitly asks to plan, split, organize, track, or resume work

If none apply, keep only the canonical task file and state in `## Plan` why planning files were skipped.

### Planning File Rules

When planning files are needed, create files in the same task folder. Use `planning-with-files` if available; otherwise write the files directly with the same names and purposes:

- `task_plan.md` — phase-level planning and status
- `findings.md` — research notes, evidence, investigation details
- `progress.md` — chronological session logs, validation results

Index planning files from the canonical task file with relative links:

```markdown
## Context

Related planning files in this task folder:

- `task_plan.md`
- `findings.md`
- `progress.md`

## Plan

See `./task_plan.md`.
```

Use Chinese prose for the task record when the surrounding workflow is Chinese; keep paths, identifiers, commands, and code terms unchanged.

### Resume Rule

When resuming a task, read the canonical task file first. Then follow links to planning files. Conflict resolution:

1. Canonical task file = authoritative index and summary
2. `task_plan.md` = phase-level planning
3. `findings.md` = evidence and investigation
4. `progress.md` = chronological logs

If files disagree, preserve evidence in subordinate files but update the canonical file so the next agent has a correct entry point.

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

Review and knowledge-gap paths do not enter Implement. Their Verify/Sink phases read `findings.md`, the canonical task `## Goal`, and any explicit review scope instead of requiring `task_plan.md`.

## Skill Prerequisites and Fallbacks

This workflow may benefit from external/global skills, but it must remain executable without them:

| Optional dependency | Used for | Fallback |
|---|---|---|
| `socratic-question` | Problem framing in Brief | Ask concise inline clarification questions, then write the same Problem Statement |
| `planning-with-files` | Structured `task_plan.md`, `findings.md`, `progress.md` maintenance | Create and update those Markdown files directly |
| `deepwork` | Complex/risky implementation sessions | Use the orchestrator's normal plan/delegate/verify workflow with explicit review gates |
| `adversarial-reviewer` | High-risk challenge review | Use the direct review checklist and route code review to an available reviewer/oracle when supported |

## Phase Transition

After each phase completes:

1. Update `## Phase Progress` in the canonical task file
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
- **abort**: mark as `cancelled`, write brief reason to `progress.md`

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
5. Always add `source_task:` frontmatter field linking back to agent task folder path
6. If no durable knowledge was produced, record `"No durable knowledge produced"` in `progress.md` and skip writing
7. If MDGraph tools fail, write file directly and call `mdgraph_sync` when available
8. After writing, ask user: "Written to vault: [note path]. Is the content correct? Any adjustments needed?" Only mark Sink done after the user confirms, or after applying requested adjustments, or after recording the skip decision.

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

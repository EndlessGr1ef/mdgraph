# Engineering Workflow Phases

7-phase framework for daily engineering work (investigation, migration, implementation). Adapted from Matt Pocock's model, restructured with problem framing and knowledge sinking as first-class phases.

## The 7 Phases

```text
Create Task → Research → PRD → Plan → Execution → QA → Sink
(Framing)    (Explore)  (Decide) (Decide HOW) (Do)  (Verify) (Crystallize)
```

| Phase | Command | Purpose | Key Tool | Deliverable |
|-------|---------|---------|----------|-------------|
| 1. Create Task | `/phase-create-task` | Deconstruct problem, create task folder | `socratic-question` | Problem + agent task folder |
| 2. Research | `/phase-research` | Gather evidence | `codegraph` + `tavily` + `mdgraph_search` | `findings.md` |
| 3. PRD | `/phase-prd` | Decide WHAT — trade-off analysis | `socratic-question` | Decision in task file |
| 4. Plan | `/phase-plan` | Decide HOW — break into tasks | `planning-with-files` | `task_plan.md` |
| 5. Execution | `/phase-execution` | Implement | `deepwork` or direct | Code changes |
| 6. QA | `/phase-qa` | Verify against PRD + plan | `adversarial-reviewer` | Verification report |
| 7. Sink | `/phase-sink` | Crystallize to vault (mandatory) | `mdgraph_create_note` | Vault note(s) |

## Agent Task Creation (Phase 1)

Create one timestamped folder under `10_agentTasks/`:

```
10_agentTasks/yyyymmdd_hhmmss_short-kebab-name/
```

Inside, create the canonical task record using the task slug without timestamp:

```
short-kebab-name.md
```

Example:

```
10_agentTasks/20260611_153000_fix-panel-drift/
├── fix-panel-drift.md
├── task_plan.md
├── findings.md
└── progress.md
```

### Canonical Task Shape

```markdown
---
id: 10_agenttasks_yyyymmdd_hhmmss_short-kebab-name
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

Use `status: done` when complete; `status: archived` only when historical and no longer active.

### When to Create Planning Files

Create colocated `task_plan.md`, `findings.md`, `progress.md` when any condition is true:

- Task has 3+ distinct steps
- Task needs cross-session recovery
- Task involves multiple agents, repos, or file areas
- Task includes research, implementation, validation, or decisions worth preserving
- User explicitly asks to plan, split, organize, track, or resume work

If none apply, keep only the canonical task file and state in `## Plan` why planning files were skipped.

### Planning File Rules

When planning files are needed, apply `planning-with-files` skill and create files in the same task folder:

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

Not all tasks need all 7 phases. After Create Task, select the shortest path:

| Work type | Phase path |
|-----------|-----------|
| Investigation (bug/error/crash) | Create → Research → PRD → Execution → QA → Sink |
| Migration / parity check | Create → Research → PRD → Plan → Execution → QA → Sink |
| Feature implementation | Create → Research → PRD → Plan → Execution → QA → Sink |
| Code review / impact analysis | Create → Research → QA → Sink |
| Knowledge gap fill | Create → Research → Sink |

Work type detection keywords should be defined in project-level `AGENTS.md`. Default to full 7-phase path when no keywords match.

## Phase Transition

After each phase completes:

1. Update `## Phase Progress` in the canonical task file
2. Find the next applicable phase (first `⬜ pending` after current; skip N/A phases)
3. Prompt user with next phase suggestion:

```text
✅ Research complete → next: /phase-prd (decide what to do)
Proceed? [yes/skip/stop/abort]
```

Options:

- **yes**: enter next phase
- **skip**: only for skippable phases; mark as `⏭️ skipped`, advance
- **stop**: return to normal conversation (task stays `in_progress`)
- **abort**: mark as `cancelled`, write brief reason to `progress.md`

For mandatory phases (QA, Sink, Execution), do NOT offer skip — only `yes/stop/abort`.

### Phase Progress Table

Initialize based on work type routing. Mark N/A phases upfront:

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Create Task | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| PRD | ⬜ pending | - |
| Plan | N/A | - |
| Execution | ⬜ pending | - |
| QA | ⬜ pending | - |
| Sink | ⬜ pending | - |
```

When resuming a task, read this table to determine current phase.

## Sink Rules (Phase 7)

Mandatory phase. Write directly to vault:

1. New reusable knowledge (concept/pattern/gotcha) → `30_knowledge/concepts/` or `30_knowledge/tools/` note
2. Investigation findings worth referencing → `20_research/` note using original task timestamp
3. Updated understanding of existing note → update via `mdgraph_update_note`
4. Always add `tags` including the project/context tag
5. Always add `source_task:` frontmatter field linking back to agent task folder path
6. If MDGraph tools fail, write file directly and call `mdgraph_sync` when available
7. After writing, ask user: "Written to vault: [note path]. Is the content correct? Any adjustments needed?"

## Skip Conditions

| Phase | Can skip? | When |
|-------|-----------|------|
| Create Task | No | Always needed |
| Research | Yes | User already has all evidence |
| PRD | Yes | Only one approach AND user agrees |
| Plan | Yes | Simple enough to execute directly |
| Execution | No | This IS the work |
| QA | No | Must verify before sinking |
| Sink | No | Must crystallize — the whole point of the vault |

## Socratic-Question Role

`socratic-question` serves two distinct roles:

- **Create Task phase**: deconstruct the problem — "Is this a timeout or a hang? What is the blast radius?"
- **PRD phase**: trade-off analysis — "Cache-based vs async-based, which one?"

Do NOT use `grill-me` or `grill-with-docs` in this framework.

## OpenCode Shortcut

OpenCode may provide `/agent-task` command that starts this workflow. The command is only a shortcut; this reference remains the durable workflow definition.
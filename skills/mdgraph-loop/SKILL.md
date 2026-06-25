---
name: mdgraph-loop
description: Loop-driven engineering workflow. Triggers on /loop-* commands. Detects task state, manages Init→Explore→Plan→Execute→Verify→Crystallize lifecycle with goal convergence checking. Built on mdgraph as persistent state spine. Do NOT trigger for casual questions, quick lookups, or simple edits.
---

# mdgraph-loop

Use this skill only for `/loop-*` commands or explicit requests to run the mdgraph loop. For casual questions, quick lookups, or single small edits, do not enter the loop.

When a `/loop-*` command runs, load this file first for shared rules, then load exactly one matching `references/<phase>.md` file. Do not preload all reference files.

## The Loop

```text
Detect → Init → Explore? → Plan → Execute → Verify ──→ Crystallize?
                       ↑                  │                    │
                       └──── loop back ───┘                    done
                       (goal not converged)
```

Explore is marked with `?` because it can be skipped if the user already has evidence. Crystallize is mandatory as a closure phase, but it may complete without creating a knowledge note when no durable knowledge was produced.

After Verify, if the goal is not converged (verification criteria not met), the loop backs up to Explore (need more evidence) or Execute (need to fix code). If converged, advance to Crystallize.

## Detect (Entry Point)

Every `/loop-*` command starts with **state detection** — check if there's an active task to resume:

1. `mdgraph_search(status: "in_progress", tag: "agent-task")` → find active tasks
2. If exactly one active task → resume it:
   - `mdgraph_get_note(id: task-id)` → parse `## Phase Progress`
   - Find last completed phase, resume from next `⬜ pending`
3. If multiple active tasks → ask user which to resume
4. If no active task → start fresh at Init

This means `/loop-init` creates a new task, while all other `/loop-*` commands resume the current task at that phase.

## The 6 Phases

| Phase | Command | Purpose | Key Tool | Deliverable | Details |
|-------|---------|---------|----------|-------------|---------|
| 1. Init | `/loop-init` | Create task, note cluster, scope work | `socratic-question`; `mdgraph_create_note` | Problem statement + 4-note cluster | [init.md](references/init.md) |
| 2. Explore | `/loop-explore` | Gather evidence (optional, skippable) | `codegraph` + `tavily` + `mdgraph_search` + `mdgraph_get_graph` | Findings note via `mdgraph_update_note` | [explore.md](references/explore.md) |
| 3. Plan | `/loop-plan` | PRD decisions + task breakdown | Direct planning; `mdgraph_update_note` | Decision record + plan note | [plan.md](references/plan.md) |
| 4. Execute | `/loop-execute` | Implement code changes | `deepwork` or direct; `mdgraph_update_note` | Code changes + progress updates | [execute.md](references/execute.md) |
| 5. Verify | `/loop-verify` | Check against goal, loop on failure | `adversarial-reviewer`; `mdgraph_update_note` | Verification report; task → `review` | [verify.md](references/verify.md) |
| 6. Crystallize | `/loop-crystallize` | Persist knowledge to vault | `mdgraph_create_note` + `mdgraph_update_note` | Vault note with bidirectional wikilinks | [crystallize.md](references/crystallize.md) |

## Agent Task Creation (Init Phase)

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

Create all 4 notes via `mdgraph_create_note` in the Init phase. Update them via `mdgraph_update_note` in subsequent phases. The task note's `aliases` field should include the slug for short-form wikilink resolution (e.g., `[[fix-panel-drift]]`).

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
| Init | ✅ done | YYYY-MM-DD |
| Explore | ⬜ pending / N/A | - |
| Plan | ⬜ pending / N/A | - |
| Execute | ⬜ pending / N/A | - |
| Verify | ⬜ pending | - |
| Crystallize | ⬜ pending / N/A | - |

## Progress

## Decisions

## Result

Knowledge crystallized: [[{knowledge-note-id}]]

## Follow-ups
```

Use `status: done` when complete, `status: cancelled` when intentionally stopped before completion, and `status: archived` only when historical and no longer active.

`## Phase Progress` is workflow state. Generic formatters must not infer, reorder, or overwrite existing status values. At most, tooling may insert this template when the section is missing; phase commands own status updates.

### When to Create the Note Cluster

Always create all 4 notes in the cluster: task, findings, plan, and progress.

If mdgraph MCP is unavailable, fall back to direct file writes and call `mdgraph_sync` when available.

### Note Cluster Rules

Each note in the cluster is an independent mdgraph node with its own id, type, status, and tags:

- Deliverable notes (findings, plan, progress) always contain `Task: [[task-id]]` as their first content line
- The task note links to all deliverables in `## Context` via wikilinks
- Phase transitions update the task note via `mdgraph_update_note` (Phase Progress + status field)
- The task note's `aliases` field includes the slug for short-form wikilink resolution

Use `planning-with-files` only as a planning structure reference. Persist all task state through `mdgraph_create_note` / `mdgraph_update_note`; if mdgraph is unavailable, write Markdown directly and sync later.

## Auto-transition & Goal Convergence

After every phase completes, the agent MUST:

1. Update task note via `mdgraph_update_note`: update `## Phase Progress` (mark current phase ✅ done + date) and update `status` field when warranted. If mdgraph MCP is unavailable, write the file directly and call `mdgraph_sync` when available.
2. **Goal convergence check**: Does the output meet the success criteria from `## Success Criteria`?
   - If **not converged** after Verify → loop back:
     - Need more evidence → `/loop-explore`
     - Need to fix code → `/loop-execute`
   - If **converged** → advance to next applicable phase
3. Find the next applicable phase (first phase after current with status `⬜ pending`; skip `N/A` phases)
4. Output the transition prompt:

```text
✅ [current phase] complete → next: /loop-[next-applicable-phase] ([purpose])
Converged: [yes/no — brief reason]
Proceed? [yes/stop/abort]
```

Options:
- **yes**: load and execute the next phase command's instructions inline
- **stop**: stop loop, return to normal conversation (task remains `in_progress`)
- **abort**: `mdgraph_update_note(id: task_id, status: "cancelled")`, write brief reason to progress note

### OpenCode `question` Tool Requirement

When running under OpenCode, any transition prompt with selectable options MUST be implemented with the `question` tool instead of a plain-text prompt. This includes `Proceed? [yes/stop/abort]`, `Proceed? [yes/skip/stop/abort]`, and Plan approval prompts.

Use plain text only as a fallback when the `question` tool is unavailable.

The Plan → Execute transition has an extra safety gate: the agent MUST ask for explicit user approval of the concrete plan before marking Plan ✅ or starting `/loop-execute`. If the plan contains unresolved decisions, use the `question` tool to resolve them first.

If the next phase is **skippable** (see skip conditions below), add a `skip` option:

```text
✅ [current phase] complete → next: /loop-[next-applicable-phase] ([purpose])
Proceed? [yes/skip/stop/abort]
```

- **skip**: mark the next phase as `⏭️ skipped` in Phase Progress, advance to the one after, and prompt again

If the next phase is **mandatory** (Execute, Verify), do NOT offer skip — only `yes/stop/abort`.

### Phase Progress Table

Initialize based on work type routing. Mark N/A phases upfront:

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Init | ✅ done | 2026-06-25 |
| Explore | ⬜ pending | - |
| Plan | ⬜ pending | - |
| Execute | ⬜ pending | - |
| Verify | ⬜ pending | - |
| Crystallize | ⬜ pending | - |
```

When resuming a task, read this table to determine current phase.

## Resume behavior

When resuming a task (via Detect entry):

1. `mdgraph_get_note(id: task-id)` — returns note body + 1-hop graph context (outlinks, backlinks)
2. Parse `## Phase Progress` from the note body to find the last completed phase
3. Follow `graph.outlinks` to reach deliverable note ids (findings, plan, progress)
4. `mdgraph_get_note(id: deliverable-id)` for each needed artifact
5. Resume from the next applicable phase (first `⬜ pending` after last ✅ done)
6. If Phase Progress is missing, enter Init phase to re-initialize
7. If phase deliverables are missing but marked done, re-enter that phase

Fallback when mdgraph MCP is unavailable:
1. Read the task note file directly from the vault path
2. Parse frontmatter and sections manually
3. Follow relative links to deliverable files
4. Call `mdgraph_sync` when tools are available again

Conflict resolution:
1. Task note = authoritative index and summary
2. Plan note = phase-level planning
3. Findings note = evidence and investigation
4. Progress note = chronological logs

If notes disagree, preserve evidence in subordinate notes but update the task note so the next agent has a correct entry point.

## Phase Orchestration (Progressive Loading)

Each phase's detailed instructions are in a separate reference file. Load only the phase you need.

| Phase | Reference File | When to Load |
|-------|---------------|--------------|
| 1. Init | [references/init.md](references/init.md) | When starting a new task (`/loop-init`) |
| 2. Explore | [references/explore.md](references/explore.md) | When gathering evidence (`/loop-explore`) |
| 3. Plan | [references/plan.md](references/plan.md) | When planning work (`/loop-plan`) |
| 4. Execute | [references/execute.md](references/execute.md) | When implementing code (`/loop-execute`) |
| 5. Verify | [references/verify.md](references/verify.md) | When verifying changes (`/loop-verify`) |
| 6. Crystallize | [references/crystallize.md](references/crystallize.md) | When persisting knowledge (`/loop-crystallize`) |

**How to use**: When a phase command is triggered, run Detect first, then load the corresponding reference file and execute its instructions. The index (this file) provides the shared rules (auto-transition, goal convergence, resume, routing) that apply to all phases.

## Work Type Routing

Not all tasks need all 6 phases. After Init, select the shortest path:

| Work type | Phase path |
|-----------|-----------|
| Investigation (bug/error/crash) | Init → Explore → Plan → Execute → Verify → Crystallize |
| Migration / parity check | Init → Explore → Plan → Execute → Verify → Crystallize |
| Feature implementation | Init → Explore → Plan → Execute → Verify → Crystallize |
| Code review / impact analysis | Init → Explore → Verify → Crystallize |
| Knowledge gap fill | Init → Explore → Crystallize |

Work type detection keywords should be defined in project-level `AGENTS.md`. Default to full 6-phase path when no keywords match.

Review and knowledge-gap paths do not enter Execute. Their Verify/Crystallize phases read the findings note, the task note `## Goal`, and any explicit review scope instead of requiring the plan note.

## Skip Conditions

| Phase | Can skip? | When |
|-------|-----------|------|
| Init | No | Always needed |
| Explore | Yes | User already has all evidence |
| Plan | No | Must plan before executing (unless simple enough for direct execution) |
| Execute | No | This IS the work |
| Verify | No | Must verify before crystallizing |
| Crystallize | No | Mandatory closure phase; may complete without creating a knowledge note |

Plan can technically be collapsed into Execute for trivial tasks (1-2 lines, single file), but the phase table should still show it as skipped or handled.

## Crystallize Rules (Phase 6)

Crystallize is mandatory as a closure phase. The agent must enter `/loop-crystallize` after Verify. If no durable knowledge was produced, record `No durable knowledge produced` in the progress note, mark Crystallize ✅, and complete the task without creating a knowledge note.

Evaluate whether durable reusable knowledge was produced:

1. New reusable knowledge (concept/pattern/gotcha) → `30_knowledge/concepts/` or `30_knowledge/tools/` note
2. Investigation findings worth referencing → `20_research/` note using original task timestamp
3. Updated understanding of existing note → update via `mdgraph_update_note`
4. Always add `tags` including the project/context tag
5. Always include `Source: [[task-id]]` wikilink in the knowledge note content (this creates the bidirectional edge for graph traversal). Also add `source_task:` frontmatter field linking back to agent task folder path as a stable reference.
6. After creating the knowledge note, update the task note: `mdgraph_update_note(id: task-id, content: ...)` — add `## Result` section with `Knowledge crystallized: [[knowledge-note-id]]`. Then `mdgraph_update_note(id: task-id, status: "done")`.
7. If no durable knowledge was produced, record `"No durable knowledge produced"` in the progress note and skip writing a knowledge note
8. If MDGraph tools fail, write file directly and call `mdgraph_sync` when available
9. After writing, ask user: "Written to vault: [note path]. Is the content correct? Any adjustments needed?" Only mark Crystallize done after the user confirms, or after applying requested adjustments, or after recording the skip decision.

## Skill Prerequisites and Fallbacks

Optional dependencies must not block the loop. If a listed skill or sub-agent is unavailable, use the fallback in the table.

| Optional dependency | Used for | Fallback |
|---|---|---|
| `socratic-question` | Problem framing in Init | Ask concise inline clarification questions, then write the same Problem Statement |
| `planning-with-files` | Structured plan, findings, progress note maintenance | Create and update those notes directly via `mdgraph_update_note` |
| `deepwork` | Complex/risky execution sessions | Use the orchestrator's normal plan/delegate/verify workflow with explicit review gates |
| `adversarial-reviewer` | High-risk challenge review | Use the direct review checklist and route code review to an available reviewer/oracle when supported |
| `@oracle` sub-agent | Maker/checker split across phases | Fall back to direct self-review checklist (see Sub-agent Token Budget below) |
| `@explorer` sub-agent | Fast research recon | Orchestrator does codegraph + mdgraph_search directly |
| `@fixer` sub-agent | Bounded implementation dispatch | Orchestrator implements directly |

## Sub-agent Token Budget

Use these thresholds to decide whether to split maker/checker work into separate sub-agent sessions:

| Phase | Split? | Threshold |
|-------|--------|-----------|
| Explore | Conditionally | Split when scope is large, unfamiliar, or multi-system. Skip for single-file known-area exploration. |
| Plan (PRD) | Conditionally | Split when multiple approaches compete or stakes are high. Skip when one approach is obvious. |
| Plan (task breakdown) | Conditionally | Split for multi-file risky changes. Skip for trivial single-file plans. |
| Execute | Always | Code changes are quality-critical. Always spawn @oracle checker after @fixer implementation. Exception: trivial < 20-line single-file changes may self-review. |
| Verify | Always | Always use adversarial-reviewer or @oracle. No self-grading of code. (Direct review checklist is the fallback when sub-agents are unavailable, not a first-choice path.) |

**Critical constraint**: The checker MUST be a separate session (different `task_id`) from the maker. Same session = inherited blind spots. The agent that wrote the code is not the one grading it.

**When sub-agents are unavailable**: Run a direct review checklist in a separate verification step after the implementation step, not interleaved with code writing.

## Socratic-Question Role

`socratic-question` serves one role in this framework:

- **Init phase**: deconstruct the problem — "Is this a timeout or a hang? What is the blast radius?"

Do NOT use `grill-me` or `grill-with-docs` in this framework.

## OpenCode Shortcut

OpenCode loads the loop commands from `.opencode/commands/loop-*.md`. The command files are the executable prompts; this skill remains the durable workflow definition.

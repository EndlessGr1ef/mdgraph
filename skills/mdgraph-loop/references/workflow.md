---
name: mdgraph-loop-workflow
description: Complete state machine rules for mdgraph-loop. Read before entering any phase.
---

# Workflow

## Canonical State

`progress.md` is the single authoritative state record.

**Frontmatter** owns task-level state:
- `status`: `in_progress`, `paused`, `blocked`, `aborted`, `done`
- `phase`: current active phase name
- `route`: one of the three named routes

**Phase Progress table** (body section) owns per-phase status and completion:
- `pending`, `in_progress`, `complete`, `skipped`, `N/A`
- Completion date recorded in the `Completed` column

While `status` is `in_progress` or `paused`, exactly one route phase is `in_progress` and frontmatter `phase` equals it.
When `status` is `done`, no route phase is `in_progress` and frontmatter `phase` remains `Crystallize`.
Completion requires close criteria, `complete` status, and a `YYYY-MM-DD` completion date.

Supporting notes (`findings.md`, `task_plan.md`) never determine task or phase state. Only `progress.md` frontmatter and Phase Progress are authoritative.

## Task Selection and Resume

1. If the user provides an explicit task ID or path, use it.
2. Otherwise, search mdgraph for `type: agent_task` + `tag: "agent-task"` + `status: in_progress`. Accept only records whose path matches `*/progress.md`. If exactly one matches the current context, select it.
3. If none are `in_progress`, search for `type: agent_task` + `tag: "agent-task"` + `status: paused`. Accept only records whose path matches `*/progress.md`. If exactly one matches, offer to resume it.
4. If multiple match at any step, ask the user to choose.
5. If none match, create a new task with `/loop-init`.

Never use body content from supporting notes (`findings.md`, `task_plan.md`) for task or phase state.
Never select the first search result solely because it is active.

If exactly one route phase is `in_progress` and frontmatter `phase` matches it, resume that phase.
If no route phase is `in_progress`: pick the earliest route phase whose status is `pending`, set it `in_progress`, update frontmatter `phase`, persist `progress.md`, then resume that phase. If no route phase has `pending` status, set task status `blocked` and require explicit repair.
If multiple phases are `in_progress` or frontmatter `phase` does not match the sole `in_progress` phase: stop, set task status `blocked`, report the conflict, and require explicit state repair. Do not auto-select or mutate dates.
If a phase has `complete` status with no completion date, or `in_progress` status with a completion date: stop and repair before continuing.

## Phase Transition

On close:
- Set the closing phase status to `complete` and record its completion date.
- Check `loopback_return` in progress.md frontmatter. If present: skip the normal next-phase transition. Set frontmatter `phase` to the `loopback_return` value and set that phase status to `in_progress`. Clear `loopback_return`. Persist `progress.md`. Load the `loopback_return` phase reference. Stop — do not proceed to the normal next-phase advance below.
- Set the next route phase status to `in_progress`.
- Update frontmatter `phase` to the new phase.
- Persist `progress.md`.
- Load the next phase reference.

Close criteria are phase-specific (defined in each reference).

Auto-advance to the next phase unless:
- The next phase is the first Execute of the task. The Execute confirmation gate (defined in references/execute.md) replaces auto-advance — present the summary and wait for user choice before implementing.
- Scope expansion is required.
- A blocking decision is required.

### Commands

- `stop`: set task status `paused`, persist, stop.
- `abort`: set task status `aborted`, persist, stop.
- `skip`: only for a phase that is optional in the selected route (Explore and/or Plan in `implementation-planned`; Explore in `non-execution`). Set that phase status to `skipped` with a date, select the next route phase whose status is `pending`, set it `in_progress`, update frontmatter `phase`, persist `progress.md`. Mandatory route phases (Init, Execute, Verify, Crystallize) cannot be skipped. In `implementation-simple` no optional phase exists — `skip` is unavailable.
- `Revise plan`: chosen at the Execute confirmation gate. Behavior depends on route:
  - `implementation-simple`: edit the minimum `task_plan.md` items requested, keep Execute `in_progress`, re-present the confirmation gate.
  - `implementation-planned`: set Execute back to `pending`, reopen Plan as `in_progress`, clear Plan's completion date, update frontmatter `phase` to Plan, persist, load Plan reference, then return to gate after Plan completes.
- Resuming a paused task: set task status back to `in_progress` before phase work.

## Verification Loopback

When convergence is `no`, first choose the target phase based on route and failure type. Do not reset Verify before this choice.

| Route | Failure type | Action |
|-------|-------------|--------|
| `implementation-simple` | Missing evidence, no code fix | Keep Verify `in_progress`. Gather evidence within Verify. Do not reopen any phase. |
| `implementation-simple` | Artifact fix needed | Verify → `pending`. Execute → `in_progress` with cleared completion date. Record `loopback_return: Verify` in progress.md frontmatter. |
| `implementation-planned` | Missing evidence | Verify → `pending`. Explore → `in_progress` with cleared completion date. Record `loopback_return: Verify` in progress.md frontmatter. |
| `implementation-planned` | Artifact fix needed | Verify → `pending`. Execute → `in_progress` with cleared completion date. Record `loopback_return: Verify` in progress.md frontmatter. |
| `non-execution` | Missing evidence | Verify → `pending`. Explore → `in_progress` with cleared completion date. Record `loopback_return: Verify` in progress.md frontmatter. |
| `non-execution` | Artifact change needed | Keep current task `blocked` with Verify as its recorded phase. Create a new implementation task. Never enter Execute. |

For all table rows that reopen a phase, update frontmatter `phase` to that phase, persist `progress.md`, and retain prior evidence — do not discard.

When a phase is reopened via a loopback row, its Close must check `loopback_return` in progress.md frontmatter:
- If present, return directly to that phase instead of following the normal next-phase transition.
- Clear `loopback_return` from progress.md frontmatter when acting on it.

When Verify is entered (including on loopback re-entry), clear any `loopback_return` field from progress.md frontmatter.

Execute re-entry within confirmed scope needs no new confirmation gate. Scope expansion does.

## MCP Fallback

When MCP is unavailable:
1. Use the resolved vault root and filesystem tools for Markdown discovery and persistence.
2. Persist canonical progress before crossing any phase boundary.
3. If safe write is impossible: leave the current phase unchanged, set task status `blocked` when possible, and stop.
4. Never continue with memory-only state.

## Crystallize Terminal Close

Crystallize is terminal — it has no next phase. On close:
- Mark Crystallize `complete` with date.
- Phase remains `Crystallize` — do not advance.
- Set task status `done`.
- Persist `progress.md`.

Do not invoke the ordinary Phase Transition for Crystallize close.

---
name: mdgraph-loop-workflow
description: Complete state machine rules for mdgraph-loop. Read before creating or resuming any task.
---

# Workflow

## Canonical State

`progress.md` is the single authoritative state record.

**Frontmatter** owns task-level state:
- `status`: `in_progress`, `paused`, `blocked`, `aborted`, `done`
- `phase`: current active phase name

**Phase Progress table** owns per-phase status:
- `pending`, `in_progress`, `complete`, `N/A`
- Completion requires a `YYYY-MM-DD` date in the `Completed` column.

Invariants:
- While task `status` is `in_progress` or `paused`, exactly one phase is `in_progress` and frontmatter `phase` equals it.
- When task `status` is `done`, no phase is `in_progress` and frontmatter `phase` is `Crystallize`.
- `plan.md` never determines task or phase state.

Phase order: Init → Prepare → Execute → Verify → Crystallize. Execute is `N/A` when the task does not change files outside the vault; every other non-`N/A` phase is mandatory.

## Task Selection and Resume

1. If the user gives a task id or path, use it.
2. Otherwise search mdgraph with filters `type: agent_task`, `tag: agent-task`, `status: in_progress` (then `paused`). Accept only records whose path ends with `/progress.md`. If exactly one matches the current context, select it.
3. If more than one matches, ask the user to choose.
4. If none match, start a new task with `/loop-init`.

Never select a result only because it is active. Never infer state from `plan.md`.

### Legacy tasks

Tasks created before 2026-08 may use the old six-phase table (Explore/Plan rows), a `route` frontmatter field, or `findings.md`/`task_plan.md` files. If a selected task uses that vocabulary, do not auto-resume it: report the difference and ask whether to migrate or start a new task. Migration replaces the Explore and Plan rows with one Prepare row — `in_progress` if either legacy phase is `in_progress`, otherwise `complete` (later date) if both are done, otherwise `pending` — and drops the old `route` field. Never modify old records silently.

Then, using only `progress.md`:
- Exactly one phase `in_progress` and frontmatter `phase` matches → resume that phase.
- No phase `in_progress` → set the earliest `pending` phase to `in_progress`, update frontmatter `phase`, persist, then load that phase reference.
- Multiple phases `in_progress`, or frontmatter `phase` mismatches the sole `in_progress` phase → set task `blocked`, report the conflict, and stop for explicit repair.
- A phase marked `complete` without a date, or `in_progress` with a date → set task `blocked` and repair before continuing.

## Phase Transition

Before closing any phase, re-check its close criteria against the latest state (restart check).

On close:
1. Set the closing phase to `complete` with completion date.
2. If `loopback_return` is present in frontmatter: set frontmatter `phase` to that value, set that phase to `in_progress`, clear `loopback_return`, persist, load that phase reference, and stop — do not continue to the normal advance.
3. Otherwise set the next phase in the fixed order whose status is `pending` to `in_progress` (skipping `N/A` phases), update frontmatter `phase`, persist, and load the next phase reference.

Auto-advance to the next phase unless the next phase is Execute. Entering Execute is always gated by the Execute confirmation protocol (`references/execute.md`) — never implement before explicit confirmation. Scope expansion or a blocking decision also pauses auto-advance.

### Commands

- `stop`: set task `paused`, persist, stop.
- `abort`: set task `aborted`, persist, stop.
- `Revise plan` at the Execute gate: set Execute to `pending` and clear its completion date if present; reopen Prepare as `in_progress` (clear its completion date); set `loopback_return: Execute`; update frontmatter `phase` to Prepare; persist; load `references/prepare.md`. After Prepare closes, the loopback returns to Execute and the gate is presented again.
- Resuming a paused task: set task `status` back to `in_progress` before phase work.

No `skip` command: every non-`N/A` phase is mandatory. The Execute yes/no decision is made once in Init.

## Verification Loopback

When convergence is `no`, choose the target by failure type before changing any status:

| Task type | Failure type | Action |
|-----------|--------------|--------|
| Execution task | Missing evidence / plan gap | Verify → `pending`; Prepare → `in_progress` (clear date); `loopback_return: Verify` |
| Execution task | Artifact fix needed | Verify → `pending`; Execute → `in_progress` (clear date); `loopback_return: Verify` |
| Non-execution task | Missing evidence | Verify → `pending`; Prepare → `in_progress` (clear date); `loopback_return: Verify` |
| Non-execution task | Artifact change outside vault needed | Keep task `blocked` with frontmatter `phase` left as Verify; create a new execution task; never enter Execute here |

For every reopen: update frontmatter `phase` to the reopened phase, persist, and retain prior evidence — do not discard it. A reopened phase's close checks `loopback_return` and returns directly to Verify instead of the normal next phase. When Verify is entered (including loopback re-entry), clear any leftover `loopback_return`.

Execute re-entry within confirmed scope needs no new confirmation. Scope expansion does.

## MCP Fallback

1. Use the resolved vault root and filesystem tools for Markdown discovery and persistence.
2. After filesystem writes, run `mdgraph_sync`.
3. Persist canonical `progress.md` before crossing any phase boundary.
4. If a safe write is impossible, leave the current phase unchanged, set task `blocked` when possible, and stop. Never continue with memory-only state.

## Crystallize Terminal Close

Crystallize is terminal — no next phase. On close: mark Crystallize `complete` with date, keep frontmatter `phase` as Crystallize, set task `status` `done`, persist. Do not invoke the ordinary Phase Transition.

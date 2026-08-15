---
name: mdgraph-loop-execute
description: Execute phase — confirm scope with the user, then implement via subagents.
---

# Execute Phase (`/loop-execute`)

Guard: if Execute is `N/A` in `## Phase Progress`, this phase must never be entered. Set task `blocked`, set Execute back to `N/A`, restore the previous valid phase if exactly one is `in_progress`; otherwise leave `blocked` for explicit repair. Stop.

Execute runs only after Prepare and only with explicit user confirmation.

## 1. Confirmation gate (mandatory)

Before any implementation, present a concise summary and wait:

- what will be done (ordered high-level tasks)
- which files will change
- risk areas
- test plan: unit tests, and integration tests when applicable

Offer the choices: confirm and execute / revise plan / abort. Use the host's interactive question mechanism when available; otherwise present the summary as a plain message and wait for explicit confirmation.

- `Revise plan`: apply the `Revise plan` transition in `references/workflow.md`.
- `Abort`: apply the `abort` command in `references/workflow.md`.

Do not implement until the user explicitly confirms. This gate replaces auto-advance for the first Execute entry of a confirmed scope; re-entry within an already confirmed scope follows the loopback rules in `references/workflow.md`.

## 2. Load state

Read `progress.md` and `plan.md` before starting.

## 3. Always delegate

The main agent never writes code. Spawn a subagent for each implementation unit, selected by capability and work size (single file → focused agent; multiple files → parallel-writing or deep-work agent). While subagents write, the main agent updates progress and reviews completed output.

## 4. Execute tasks

Work through `plan.md` ordered tasks. Log meaningful progress in `progress.md` after each step. Keep the main agent on orchestration and review.

## 5. Failed attempts

On failure: record it in `progress.md`, adjust the approach, and do not repeat the same failed action immediately.

## 6. Close criteria

- All tasks from `plan.md` complete.
- Progress logged per step; failures recorded and resolved.
- `progress.md` and `plan.md` updated.

Convergence review belongs to Verify — do not duplicate it here. Apply the Phase Transition rules in `references/workflow.md`.

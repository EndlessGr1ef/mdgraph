---
name: mdgraph-loop-execute
description: Execute phase — implement the approved plan and log progress.
---

# Execute Phase (`/loop-execute`)

Implement the approved plan and keep the progress note current.

## 1. Confirmation gate (mandatory)

Before any implementation begins, present a concise execution summary to the user:

- What will be done (high-level tasks)
- Which files will change
- Risk areas

Use the OpenCode `question` tool with these options:

- `Confirm and execute` — proceed with implementation
- `Revise plan` — user wants changes to the plan before proceeding
- `Abort` — cancel the task

Do not proceed to implementation until the user chooses `Confirm and execute`. This gate replaces the old Plan approval.

## 2. Always delegate

The main agent never writes code. Spawn a subagent for every implementation unit:

- Single file change: `@fixer`
- Multiple files: `task` (background) for parallel writes or `deepwork` for complex work
- Context gathering: `@explorer`

While subagents write, the main agent reads ahead, updates progress, or reviews completed output.

## 3. Load state

Read the task note, the plan note, and the progress note before starting.

## 4. Execute tasks

Work through the ordered plan items. Log meaningful progress after each step.

Keep the main agent's context on orchestration and review; push implementation details into subagents.

## 5. Failed attempt behavior

If a step fails:

- record the failure in the progress note
- adjust the approach before retrying
- do not repeat the same failed action immediately

## 6. Review policy

Apply the shared Subagent Policy for every non-trivial change. When using subagent delegation, run a separate review pass (adversarial or checklist) before closing.

## 7. Close

Close using the shared Close Phase Protocol.

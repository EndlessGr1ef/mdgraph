---
name: mdgraph-loop-execute
description: Execute phase — implement the approved plan and log progress.
---

# Execute Phase (`/loop-execute`)

Route guard: if the task route is `non-execution`, this phase must never be entered. See route definitions in SKILL.md and loopback rules in references/workflow.md. Set task status `blocked`. Restore: set Execute status to `N/A` in Phase Progress. If a unique valid route phase (Explore, Verify, or Crystallize) is already `in_progress`, restore frontmatter `phase` to it. Otherwise leave `blocked` for explicit repair — do not point `phase` at a completed or `N/A` phase. Stop.

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

If the user chooses `Revise plan`, apply the route-specific Revise plan transition defined in references/workflow.md Phase Transition commands.

Do not proceed to implementation until the user chooses `Confirm and execute`. This gate replaces auto-advance for the first Execute entry.

## 2. Always delegate

The main agent never writes code. Spawn a subagent for every implementation unit. Select the agent by capability for the work size:

- Single file change: focused implementation agent.
- Multiple files: parallel-writing or deep-work agent.
- Context gathering: exploratory research agent.

While subagents write, the main agent reads ahead, updates progress, or reviews completed output.

## 3. Load state

Read `progress.md`, `task_plan.md`, and `findings.md` before starting.

## 4. Execute tasks

Work through the ordered plan items. Log meaningful progress after each step.

Keep the main agent's context on orchestration and review; push implementation details into subagents.

## 5. Failed attempt behavior

If a step fails:

- record the failure in the progress note
- adjust the approach before retrying
- do not repeat the same failed action immediately

## 6. Close criteria

- All implementation tasks from `task_plan.md` complete.
- Progress logged for each step.
- Failures recorded and resolved.
- `progress.md`, `findings.md`, and `task_plan.md` updated.

Convergence review is the responsibility of the Verify phase — do not duplicate it here.

Update `progress.md`, `findings.md`, and `task_plan.md` as needed. Apply the Phase Transition rules in references/workflow.md.

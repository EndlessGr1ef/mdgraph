---
name: mdgraph-loop-plan
description: Plan phase — confirm decisions, write the PRD record, and break work into tasks.
---

# Plan Phase (`/loop-plan`)

Turn findings into confirmed decisions and an actionable plan.

## 1. Requirement review

Review the task goal, constraints, success criteria, and findings. Confirm:

- the real user goal
- risky assumptions
- hard constraints
- available approaches
- what must be true before implementation

## 2. Decision confirmation

If there are unresolved decisions, use the OpenCode `question` tool or a concise inline prompt to confirm them.

## 3. PRD / decision record

Write the full decision record into `plan.md`, and copy the confirmed decisions summary to the task note `## Decisions`. Include:

- findings summary
- confirmed decisions
- chosen approach
- rejected alternatives
- scope and non-goals
- success criteria

## 4. Task breakdown

Write the plan note with:

- ordered tasks
- dependencies
- files involved
- verification criteria
- risk areas

Apply the shared Subagent Policy when the plan is broad, high-risk, or has competing approaches.

## 5. Approval gate

The concrete plan must be approved before Execute. This approval gate replaces the generic Close Phase transition prompt. Use the OpenCode `question` tool with these options:

- `Approve and execute`
- `Approve and stop`
- `Revise plan`
- `Abort`

Do not mark Plan `✅ done` or enter Execute until the user chooses `Approve and execute`. If the user chooses `Approve and stop`, mark Plan `✅ done` and stop without entering Execute.

## 6. Close

Close using the shared Close Phase Protocol.

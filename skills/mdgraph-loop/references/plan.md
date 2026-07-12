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

Write the full decision record into `plan.md`, and copy the confirmed decisions summary to `progress.md` `## Decisions`. Include:

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

## 5. Auto-approve

If all decisions are clear and the plan is sound, auto-approve and proceed directly to Execute. No user confirmation is needed at this stage.

Only reach out to the user if the task requirements or approach are fundamentally ambiguous — use a single concise question, then proceed.

## 6. Close

Update `task_plan.md` and `progress.md`.

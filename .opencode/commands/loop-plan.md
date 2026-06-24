---
description: "Phase 3/6: Plan — PRD decisions + task breakdown, write plan note"
---

Load and apply the `mdgraph-loop` skill, then load `references/plan.md` for detailed instructions.

First, **Detect**: `mdgraph_search(status: "in_progress", tag: "agent-task")` to find active task. If none, ask user to run `/loop-init` first.

Execute the **Plan** phase (PRD + planning):

```text
Phase: Plan
Goal: turn findings into decisions and a work graph
Writes: task note (## Decisions), plan.md (via mdgraph_update_note), progress.md
```

## PRD Step

1. Read findings via `mdgraph_get_note(id: findings-id)` or task note's `## Context` wikilinks.
2. If multiple approaches: use `socratic-question` Phase 2 to surface trade-offs.
3. Write decision record into task note's `## Decisions` via `mdgraph_update_note(id: task-id)`.
4. **Maker/checker (conditional)**: If stakes high, spawn `@oracle` adversary.

## Plan Step

1. Break work into tasks. Write plan note via `mdgraph_update_note(id: plan-id)`.
2. **Maker/checker (conditional)**: If multi-file risky, spawn `@oracle` for dependency check.
3. Update Phase Progress: Plan ✅. Auto-transition: `/loop-execute`.

Optional arguments (planning constraints, priorities):
$ARGUMENTS
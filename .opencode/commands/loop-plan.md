---
description: "Phase 3/6: Plan — PRD decisions + task breakdown, write plan note via mdgraph"
---

Load and apply the `engineering-phase` skill, then load `references/plan.md` for detailed execution instructions.

Execute the **Plan** phase (includes PRD and planning):

```text
Phase: Plan
Goal: turn findings into decisions and a work graph with verification criteria
Writes: task note (## Decisions), plan.md (via mdgraph_update_note), progress.md
```

## PRD Step

1. **Read findings**: `mdgraph_get_note(id: findings-id)` or read from task note's `## Context` wikilinks.
2. **If multiple approaches exist**: use `socratic-question` Phase 2 (Deep Exploration) to surface trade-offs. Present as structured options.
3. **If only one approach is viable**: state the approach and why alternatives don't apply.
4. **Write decision record** into task note's `## Decisions` via `mdgraph_update_note(id: task-id, content: ...)`.
5. **Maker/checker (conditional)**: If multiple approaches competed or stakes are high, spawn `@oracle` in a **separate session** as adversary. Skip checker when one approach is obvious.

## Plan Step

1. **Break work into tasks** based on PRD decisions.
2. **Write plan note** via `mdgraph_update_note(id: plan-id, content: ...)`. Include:
   - Ordered task list with dependencies
   - Each task: description, files involved, verification criteria
   - Risk areas flagged
3. **Maker/checker (conditional)**: If plan involves multi-file risky changes, spawn `@oracle` in a **separate session** for dependency check. Skip for trivial single-file plans.

4. **Update Phase Progress**: Plan ✅ + date via `mdgraph_update_note(id: task-id)`

5. **Auto-transition**: prompt `/phase-implement` (mandatory, no skip).

Optional arguments (specific planning constraints, task priorities):
$ARGUMENTS

---
name: mdgraph-loop-plan
description: Plan phase — PRD decisions + task breakdown. Load this when the user says /loop-plan.
---

# Plan Phase (`/loop-plan`)

Includes PRD (decision record) and plan (task breakdown).

## PRD Step

1. Review findings note from Explore phase (via `mdgraph_get_note(id: findings-id)` or task note's `## Context` wikilinks).
2. If multiple approaches exist:
   - Use `socratic-question` Phase 2 (Deep Exploration) to surface trade-offs
   - Present approaches as structured options
3. If only one approach is viable:
   - State the approach and why alternatives don't apply
4. Write decision record into task note's `## Decisions` via `mdgraph_update_note(id: task-id, content: ...)`
5. **Maker/checker (conditional)**: If multiple approaches competed or stakes are high, spawn `@oracle` adversary. Skip when one approach is obvious.

## Plan Step

1. Based on PRD decisions, break work into tasks.
2. Write plan note via `mdgraph_update_note(id: plan-id, content: ...)`:
   - Ordered task list with dependencies
   - Each task: description, files involved, verification criteria
   - Risk areas flagged
3. **Maker/checker (conditional)**: If multi-file risky changes, spawn `@oracle` for dependency check. Skip for trivial plans.
4. Update Phase Progress: Plan ✅
5. Auto-transition: `/loop-execute`

## Output

Plan note via `mdgraph_update_note`
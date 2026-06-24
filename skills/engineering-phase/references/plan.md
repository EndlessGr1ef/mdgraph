---
name: engineering-phase-plan
description: Plan phase — build work graph, dependencies, verification criteria. Covers both PRD and planning steps. Load this when the user says /phase-plan or /phase-prd.
---

# Plan Phase (`/phase-plan`)

Includes PRD (decision record) and plan (task breakdown). The PRD step runs first, then the plan step breaks work into ordered tasks.

## PRD Step (`/phase-prd`)

1. Review findings note from Research phase (via `mdgraph_get_note(id: findings-id)` or read from task note's `## Context` wikilinks).
2. If multiple approaches exist:
   - Use `socratic-question` Phase 2 (Deep Exploration) to surface trade-offs
   - Present approaches as structured options
3. If only one approach is viable:
   - State the approach and why alternatives don't apply
4. Write decision record into task note's `## Decisions` section via `mdgraph_update_note(id: task-id, content: ...)`:
   ```markdown
   ## Decisions
   - **Chosen approach**: [approach name]
   - **Why**: [reasoning]
   - **Alternatives rejected**: [list + why]
   - **Risks**: [known risks]
   - **Scope confirmation**: [what's in, what's out]
   ```
5. **Maker/checker (conditional)**: If multiple approaches competed or stakes are high, spawn `@oracle` in a **separate session** as adversary:
   - Prompt: "Why would this approach fail? What edge cases did we miss? What's the weakest assumption in the decision record?"
   - If oracle surfaces valid concerns → update `## Decisions` via `mdgraph_update_note(id: task-id)`
   - If oracle confirms decisions → proceed
   - Skip checker when one approach is obvious (see Sub-agent Token Budget)

6. Update Phase Progress: PRD ✅
7. Auto-transition: prompt next applicable phase

## Plan Step (`/phase-plan`)

1. Based on PRD decisions, break work into tasks.
2. Write plan note via `mdgraph_update_note(id: plan-id, content: ...)`. The plan note should contain:
   - Ordered task list with dependencies
   - Each task: description, files involved, verification criteria
   - Risk areas flagged
3. **Maker/checker (conditional)**: If plan involves multi-file risky changes, spawn `@oracle` in a **separate session** for dependency check:
   - Prompt: "Review the plan note. Are task boundaries clean? Are there hidden coupling points? Is the verification criteria sufficient? Any parallelization opportunities missed?"
   - If oracle surfaces issues → update plan note via `mdgraph_update_note(id: plan-id)`
   - If oracle confirms plan → proceed
   - Skip checker for trivial single-file plans (see Sub-agent Token Budget)

4. Update Phase Progress: Plan ✅
5. Auto-transition: prompt next applicable phase (typically `/phase-implement`)

## Output

Plan note via `mdgraph_update_note`

---
name: mdgraph-loop-plan
description: Plan phase — planning decisions first, then PRD + task breakdown. Load this when the user says /loop-plan.
---

# Plan Phase (`/loop-plan`)

Three sequential steps: Plan (decide + confirm) → PRD (document) → Task Breakdown (commit).

## Plan Step

1. Review findings note from Explore phase (via `mdgraph_get_note(id: findings-id)` or task note's `## Context` wikilinks).

2. Run Requirement Review:
   - What is the user's actual goal, not just the requested implementation?
   - What assumptions would be risky to make silently?
   - What constraints are fixed: data safety, compatibility, UX, performance, dependencies, timeline?
   - What could go wrong if we execute the obvious plan?
   - What does success look like in verifiable terms?
   - Which decisions need user confirmation before code execution?

3. If Requirement Review exposes ambiguity, hidden requirements, multiple viable approaches, or high-impact trade-offs:
   - Use `socratic-question` Phase 2 only when deeper exploration is needed.
   - Use the OpenCode `question` tool to resolve concrete user decisions.

4. Record confirmed decisions.

5. **Hard stop**: Do not continue to PRD Step until all execution-affecting decisions are either confirmed by the user via the `question` tool or documented as safe, reversible, low-impact assumptions.

## PRD Step

1. Write the PRD / decision record from existing context only:
   - Findings summary
   - Confirmed user decisions from Plan Step
   - Chosen approach
   - Rejected alternatives and why
   - Scope and non-goals
   - Success criteria
2. Do not ask new questions in PRD Step unless a contradiction is discovered.
3. If a contradiction is discovered, stop and return to Plan Step.

## Task Breakdown Step

1. Based on PRD decisions, break work into ordered tasks.
2. Write plan note via `mdgraph_update_note(id: plan-id, content: ...)`:
   - Ordered task list with dependencies
   - Each task: description, files involved, verification criteria
   - Risk areas flagged
3. **Maker/checker (conditional)**: If multi-file risky changes, spawn `@oracle` for dependency check. Skip for trivial plans.
4. Present the final plan summary and call the OpenCode `question` tool:
   - `Approve and execute`
   - `Revise plan`
5. Only after approval: update Phase Progress: Plan ✅. Auto-transition: `/loop-execute`.

**Hard stop**: Do not mark Plan ✅ or enter `/loop-execute` until the user approves the final plan.

## Output

Plan note via `mdgraph_update_note`

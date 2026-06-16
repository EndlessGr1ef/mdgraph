---
description: "Phase 4/7: Plan — break PRD decisions into executable tasks, write task_plan.md"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Plan** phase:

1. **Read current state**: Read the active agent task's canonical task file (especially `## Decisions`) + `findings.md`.

2. **Break work into tasks**: Based on PRD decisions, create `task_plan.md` with:
   - Ordered task list with clear dependencies
   - Each task includes:
     - Description (what to do)
     - Files involved (which files to touch)
     - Verification criteria (how to know it's done)
   - Flag risk areas and uncertain steps
   - Estimate complexity: simple (direct) / medium (sequential) / complex (deepwork)

3. **Write `task_plan.md`** in the task folder.

4. **Update Phase Progress**: Plan ✅ + date

5. **Auto-transition**: Find next applicable phase (first `⬜ pending` after Plan) and prompt:
   ```
   ✅ Plan complete → next: /phase-execution (start implementing)
   Proceed? [yes/stop/abort]
   ```
   - **yes** → execute Execution phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`
   - No skip option (Execution is mandatory from Plan)

Optional arguments (specific planning constraints, task priorities):
$ARGUMENTS

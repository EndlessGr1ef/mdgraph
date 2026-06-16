---
description: "Phase 3/6: Plan — build task_plan.md as work graph / lanes / dependencies / verification criteria"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Plan** phase:

1. **Read current state**: Read the active agent task's canonical task file (especially `## Goal`, `## Context`, `## Decisions` from Brief/Research) + `findings.md`.

2. **Break work into tasks**: Use `planning-with-files` if available; otherwise write the file directly. Create `task_plan.md` with:
   - Work graph: ordered task list with clear dependencies between items
   - Lanes: group related work into parallel tracks where possible
   - Each task includes:
     - Description (what to do)
     - Files involved (which files to touch)
     - Dependencies (which tasks must complete first)
     - Verification criteria (how to know it's done)
   - Flag risk areas and uncertain steps
   - Estimate complexity: simple (direct) / medium (sequential) / complex (deepwork)

3. **Write `task_plan.md`** in the task folder.

4. **Update Phase Progress**: Plan ✅ + date

5. **Auto-transition**: prompt:
   ```
   ✅ Plan complete → next: /phase-implement (start implementing)
   Proceed? [yes/stop/abort]
   ```
   - **yes** → execute Implement phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`
   - No skip option (Implement is mandatory from Plan)

Optional arguments (specific planning constraints, task priorities):
$ARGUMENTS

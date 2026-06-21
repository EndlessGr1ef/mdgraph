---
description: "Phase 3/6: Plan — build task_plan.md as work graph / lanes / dependencies / verification criteria"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Plan** phase:

Start with a short terminal-visible note:

```text
Phase: Plan
Goal: turn findings into a work graph with verification criteria
Writes: task_plan.md, progress.md, canonical task file
```

1. **Read current state**: Read the active agent task's canonical task file (especially `## Goal`, `## Context`, `## Decisions` from Brief/Research) + `findings.md`.

2. **Break work into tasks**: For Medium and Large tasks, the agent MUST use the actual planning-with-files skill. Within engineering-phase, the active agent task folder is the planning workspace. For Small tasks, direct `task_plan.md` writing is allowed. Create `task_plan.md` with:
   - Work graph: ordered task list with clear dependencies between items
   - Lanes: group related work into parallel tracks where possible
   - Each task includes:
     - Description (what to do)
     - Files involved (which files to touch)
     - Dependencies (which tasks must complete first)
     - Verification criteria (how to know it's done)
   - Flag risk areas and uncertain steps
   - Estimate complexity: simple (direct) / medium (sequential) / complex (checkpointed sequential)
   - For Large tasks: include at least one Mermaid diagram in `findings.md` or `task_plan.md`

3. **Write `task_plan.md`** in the task folder.

4. **Update Phase Progress**: Plan ✅ + date

5. **Record phase exit checklist**: Write a brief checklist summary to `progress.md`.

6. **Auto-transition**: prompt:
    ```
    ✅ Plan complete → next: /phase-implement (start implementing)
    Updated: [files]
    Key points: [work graph, risks, verification criteria]
    Proceed? [yes/stop/abort]
    ```
   - **yes** → execute Implement phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`
   - No skip option (Implement is mandatory from Plan)

Optional arguments (specific planning constraints, task priorities):
$ARGUMENTS

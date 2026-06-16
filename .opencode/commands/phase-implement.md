---
description: "Phase 4/6: Implement — dispatch specialist lanes, implement, reconcile results, update progress"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Implement** phase:

1. **Read current state**: Read the active agent task's `task_plan.md` + `## Decisions` from canonical task file. If Implement is pending but `task_plan.md` is missing or empty, stop and create a minimal plan from `## Decisions` before implementing.

2. **Dispatch specialist lanes** based on task_plan.md:
   - For each lane or task group, determine the right implementation approach:
     | Condition | Approach |
     |-----------|----------|
     | Single-file fix, < 20 lines | Direct implementation |
     | Multi-step but sequential, < 5 files | Sequential: work through tasks one by one, verify each before proceeding |
     | Complex, multi-file, risky | `deepwork` with oracle review gates |
   - Track task IDs as you go — log each sub-task's ID and status in `progress.md`

3. **Implement work** following task_plan.md order:
   - For each task: implement → verify against verification criteria → proceed to next
   - Update `progress.md` with what was done, task IDs, and any decisions made during implementation
   - If a task fails verification: re-attempt (max 3), then ask user

4. **Reconcile results/conflicts**:
   - After all tasks complete, verify there are no cross-task conflicts
   - Run full verification against task_plan criteria and decisions
   - Update `progress.md` with reconciliation notes

5. **Update Phase Progress**: Implement ✅ + date

6. **Auto-transition**: prompt `/phase-verify` (mandatory, no skip):
   ```
   ✅ Implement complete → next: /phase-verify (run checks and review gates)
   Proceed? [yes/stop/abort]
   ```
   - **yes** → execute Verify phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (specific tasks to execute, verification focus):
$ARGUMENTS

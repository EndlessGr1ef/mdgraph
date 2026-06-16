---
description: "Phase 5/7: Execution — implement the plan using deepwork or direct coding"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Execution** phase:

1. **Read current state**: Read the active agent task's `task_plan.md` + `## Decisions` from canonical task file.

2. **Choose execution mode** based on task complexity from task_plan.md:

   | Condition | Mode |
   |-----------|------|
   | Single-file fix, < 20 lines | Direct implementation |
   | Multi-step but sequential, < 5 files | Sequential implementation: work through task_plan items one by one, verify each before proceeding |
   | Complex, multi-file, risky | `deepwork` with oracle review gates |

3. **Execute tasks** following task_plan.md order:
   - For each task: implement → verify against verification criteria → proceed to next
   - Update `progress.md` with what was done in each step
   - If a task fails verification: re-attempt (max 3), then ask user

4. **After all tasks complete**: run full verification against PRD decisions and task_plan criteria.

5. **Update Phase Progress**: Execution ✅ + date

6. **Auto-transition**: prompt `/phase-qa` (mandatory, no skip):
   ```
   ✅ Execution complete → next: /phase-qa (verify changes)
   Proceed? [yes/stop/abort]
   ```
   - **yes** → execute QA phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (specific tasks to execute, verification focus):
$ARGUMENTS

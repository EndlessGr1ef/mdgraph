---
description: "Phase 5/6: Verify — run checks/review gates, record verification, loop to Plan/Implement on failure"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Verify** phase:

1. **Read current state**: Read canonical task file (`## Decisions`, `## Goal`) + `findings.md` + `progress.md` + `task_plan.md`.

2. **Run checks/review gates** against the available phase inputs:
   - For critical/risky changes → use an external reviewer skill if available
   - For straightforward changes → direct review checklist:
     - [ ] Changes or findings match the goal and decisions from Brief/Plan
     - [ ] All applicable task_plan items are addressed, or Plan is N/A with a documented reason
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled or noted as out of scope

3. **Record verification results** in `progress.md`.

4. **If verification fails**:
   - Report issues clearly
   - Offer to loop back to Plan or Implement depending on root cause:
     - Design/approach issue → `/phase-plan`
     - Implementation bug → `/phase-implement`
   - Do NOT auto-advance to Sink until verification passes

5. **Update Phase Progress**: Verify ✅ + date

6. **Auto-transition**: prompt `/phase-sink`:
   ```
   ✅ Verify complete → next: /phase-sink (crystallize knowledge to vault)
   Proceed? [yes/skip/stop/abort]
   ```
   - **yes** → execute Sink phase inline
   - **skip** → only offered if Sink is skippable (no durable knowledge); mark as `⏭️ skipped`, complete task
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (specific areas to verify, review focus):
$ARGUMENTS

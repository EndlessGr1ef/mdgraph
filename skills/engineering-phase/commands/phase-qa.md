---
description: "Phase 6/7: QA — verify changes against PRD decisions and task_plan (adversarial-reviewer)"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **QA** phase:

1. **Read current state**: Read canonical task file (`## Decisions`, `## Goal`) + `task_plan.md`.

2. **Review code changes** against PRD decisions:
   - For critical/risky changes → use `adversarial-reviewer` skill
   - For straightforward changes → direct review checklist:
     - [ ] Changes match PRD decisions
     - [ ] All task_plan items addressed
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled

3. **Record verification results** in `progress.md`.

4. **If verification fails**: report issues, offer to loop back to Execution.

5. **Update Phase Progress**: QA ✅ + date

6. **Auto-transition**: prompt `/phase-sink` (mandatory, no skip):
   ```
   ✅ QA complete → next: /phase-sink (crystallize knowledge to vault)
   Proceed? [yes/stop/abort]
   ```
   - **yes** → execute Sink phase inline
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (specific areas to verify, review focus):
$ARGUMENTS

---
description: "Phase 5/6: Verify — run checks/review gates, adversarial review + oracle reconciliation"
---

Load and apply the `engineering-phase` skill, then load `references/verify.md` for detailed execution instructions.

Execute the **Verify** phase:

```text
Phase: Verify
Goal: verify outputs against the goal and plan decisions
Writes: progress.md (via mdgraph_update_note), task status → review
```

1. **Read current state**: task note (`## Decisions`, `## Goal`) + findings note + plan note + progress note.

2. **Review code changes** against PRD decisions and plan note:
   - For critical/risky changes → use `adversarial-reviewer` skill
   - For straightforward changes → direct review checklist:
     - [ ] Changes match PRD decisions
     - [ ] All plan items addressed
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled

3. **Oracle reconciliation** (when adversarial-reviewer used): spawn `@oracle` in a **separate session** to reconcile:
   - Prompt: "Reconcile the adversarial review findings. Which are actionable? Which are noise? What's the fix priority?"
   - If actionable issues exist → loop back to Execution for fixes
   - If no actionable issues → proceed

4. **Record verification results** in progress note via `mdgraph_update_note`. Update task status to `review` via `mdgraph_update_note(id: task-id, status: "review")`.

5. **If verification fails** → report issues, offer to loop back to Execution.

6. **Update Phase Progress**: Verify ✅ + date via `mdgraph_update_note(id: task-id)`

7. **Auto-transition**: prompt `/phase-sink` (mandatory, no skip offered).

Optional arguments (specific areas to verify, review focus):
$ARGUMENTS

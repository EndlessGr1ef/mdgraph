---
name: engineering-phase-verify
description: Verification phase — run checks/review gates, loop on failure. Load this when the user says /phase-verify.
---

# Verify Phase (`/phase-verify`)

Run checks, review gates, and loop on failure.

## Steps

1. Review code changes against PRD decisions and plan note:
   - For critical/risky changes → use `adversarial-reviewer` skill
   - For straightforward changes → direct review checklist:
     - [ ] Changes match PRD decisions
     - [ ] All plan items addressed
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled

2. **Oracle reconciliation (when adversarial-reviewer used)**: After adversarial-reviewer produces critique, spawn `@oracle` in a **separate session** to reconcile:
   - Prompt: "Reconcile the adversarial review findings. Which are actionable? Which are noise? What's the fix priority?"
   - Update progress note with reconciled action items via `mdgraph_update_note`
   - If actionable issues exist → loop back to Execution for fixes
   - If no actionable issues → proceed

3. Record verification results in the progress note via `mdgraph_update_note`. Update task status to `review` via `mdgraph_update_note(id: task-id, status: "review")`.

4. If verification fails → report issues, offer to loop back to Execution.

5. Update Phase Progress: Verify ✅
6. Auto-transition: prompt `/phase-sink` (mandatory, no skip offered)

## Output

Verification report in progress note; task status → `review`

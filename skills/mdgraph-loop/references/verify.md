---
name: mdgraph-loop-verify
description: Verify phase — run checks, goal convergence check, loop on failure. Load this when the user says /loop-verify.
---

# Verify Phase (`/loop-verify`)

Run checks and decide if goal has converged.

## Steps

1. Review code against PRD decisions and plan note:
   - Critical/risky → `adversarial-reviewer` skill
   - Straightforward → direct checklist

2. **Oracle reconciliation** (when adversarial-reviewer used): spawn `@oracle` to reconcile findings. If actionable issues → loop to Execute.

3. **Goal convergence check**: Does output meet `## Success Criteria`?
   - Not converged → loop back to Explore (more evidence) or Execute (fix code)
   - Converged → proceed to Crystallize

4. Record results in progress note. Update task status → `review`.

5. Update Phase Progress: Verify ✅
6. Auto-transition: `/loop-crystallize` (mandatory)

## Output

Verification report; task status → `review`
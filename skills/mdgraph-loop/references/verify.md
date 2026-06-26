---
name: mdgraph-loop-verify
description: Verify phase — check success criteria, reconcile review findings, and document convergence.
---

# Verify Phase (`/loop-verify`)

Check the work against the task goal and success criteria.

## 1. Review checklist

Review the relevant artifact against:

- task goal
- implementation for execution routes
- findings, diff, and impact scope for review routes
- plan and PRD decisions when Plan was applicable
- constraints
- success criteria

## 2. Review depth

Use the shared Subagent Policy:

- adversarial review for risky work
- direct checklist for straightforward work

## 3. Success criteria mapping

Map each check to a success criterion and record the result.

## 4. Convergence evidence report

Write the verification report into `progress.md` under `## Verification`; copy only the convergence summary to the task note if needed. Include:

- checks run
- evidence observed
- open gaps
- convergence decision: `yes` or `no`
- if `no`, the required loopback: Explore for missing evidence or Execute for code fixes
- residual risks

If the work is not converged, record the blocking gaps, keep Verify pending, and do not mark Verify `✅ done`.

If the work is converged, update the task status to `review` before closing Verify so `/loop-crystallize` can resume the handoff.

## 5. Close

Close using the shared Close Phase Protocol only when convergence is `yes`. When convergence is `no`, prompt the loopback phase without closing Verify.

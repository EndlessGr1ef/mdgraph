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

Write the verification report into `progress.md` under `## Verification`. Include:

- checks run
- evidence observed
- open gaps
- convergence decision: `yes` or `no`
- if `no`, the required loopback: Explore for missing evidence or Execute for code fixes
- residual risks

If the work is not converged, record the blocking gaps and keep Verify pending.

If the work is converged, update the task `phase` to `Crystallize` before closing Verify.

## 5. Close

Update `progress.md`, `findings.md`, and `task_plan.md` as needed. Only close when convergence is `yes`. When `no`, prompt the loopback phase.

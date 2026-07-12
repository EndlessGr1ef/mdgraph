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

Apply the Subagent Policy defined in SKILL.md. For code-changing routes, the verifier must not be the same agent that performed Execute.

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
- if `no`, the required action selected by the route-aware Verification Loopback rules in SKILL.md
- residual risks

If converged, proceed to close and set `phase` to Crystallize.

If not converged, apply the Verification Loopback rules defined in SKILL.md.

## 5. Close

Update `progress.md`, `findings.md`, and `task_plan.md` as needed. Only close when convergence is `yes`. Apply the Phase Transition rules in SKILL.md to close this phase and advance to Crystallize.

When convergence is `no`, do not close. Apply the loopback procedure in section 4 instead.

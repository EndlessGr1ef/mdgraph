---
name: mdgraph-loop-verify
description: Verify phase — map success criteria, run unit/integration tests for code projects, decide convergence.
---

# Verify Phase (`/loop-verify`)

Check the work against the goal and success criteria.

## 1. Review checklist

Review the relevant artifact against:

- task goal and success criteria
- `plan.md` decisions, verification criteria, and rejected alternatives
- implementation and diff for execution tasks
- findings and evidence for non-execution tasks
- constraints and risks

For execution tasks, use a separate agent invocation from the one that implemented (Subagent Policy in SKILL.md).

## 2. Tests for code projects

When the task changes code outside the vault:

- Identify the project's test commands from its manifest (package.json, Makefile, etc.). Do not assume a command exists.
- Run unit tests (UT) and record command + result.
- Run integration tests (IT) when they exist and are within the approved scope; if none exist, say so explicitly and count it as a residual risk.
- Map each test result to the success criteria it covers.
- Tests are evidence, not a substitute for review: for risky work add adversarial or manual checks.

## 3. Success criteria mapping

Map every check and test result to a success criterion in `progress.md`.

## 4. Convergence report

Write into `progress.md` `## Verification`:

- checks run and results (including UT/IT)
- evidence observed
- success-criteria mapping
- open gaps
- convergence decision: `yes` or `no`
- if `no`: required action from Verification Loopback in `references/workflow.md`
- residual risks

## 5. Close

Convergence `yes` → apply Phase Transition to Crystallize. Convergence `no` → do not close; apply the loopback procedure in `references/workflow.md`.

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
- findings and evidence for non-execution tasks (accumulated in `progress.md` `## Findings`)
- constraints and risks

For execution tasks, use a separate agent invocation from the one that implemented (Subagent Policy in SKILL.md).

### Adversarial checks to run every pass

Beyond reading the artifact, run these — each one has caught a blocking defect that a green suite did not:

- **Clause-by-clause against the plan.** Walk `plan.md` and ask of each requirement "where in the diff is this satisfied?" A requirement that is declared but never populated, or implemented as a weaker version of what was written, is the most common blocking defect.
- **Re-derive the plan's numbers from source** rather than trusting the document. Counts, file paths and line numbers in a plan go stale as the work proceeds.
- **Falsify the new tests.** For each test the implementation added, name a behaviour-breaking edit that leaves it passing. Report the ones you can break — those tests guard nothing.
- **Merged-tree verification.** If several agents wrote concurrently, ignore their summaries and re-run the full suite, lint and typecheck yourself.
- **Same-shape check on fixes.** Ask whether the fix could reproduce the bug it addresses, on a different input.
- **Degenerate-input check.** For any scoring, ranking, gating or truncation logic, work through: all-equal values, all-zero, empty collection, single element, oversized element, values out of range, and a malformed-but-parseable response.

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

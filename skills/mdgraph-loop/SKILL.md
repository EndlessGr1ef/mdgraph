---
name: mdgraph-loop
description: >-
  Lightweight loop-driven engineering workflow backed by mdgraph and KnowledgeVault.
  Init → Prepare → Execute (only when changes happen outside the vault) → Verify → Crystallize,
  with a short human checkpoint in Prepare (1–5 questions or risk items) and a confirmation gate before Execute.
---

# mdgraph-loop

Phase references: `references/<phase>.md` — read the matching reference before entering a phase.
Workflow rules: `references/workflow.md` — read before creating or resuming any task.
Templates: `templates/{progress,plan}.md`.

Read exactly one phase reference before doing phase work. Do not preload all references.

## Canonical State

`progress.md` is the single authoritative state record. Frontmatter (`status`, `phase`) owns task-level state. The `## Phase Progress` table owns per-phase status and completion dates. `plan.md` is a working document and never determines state.

While `status` is `in_progress` or `paused`, exactly one phase is `in_progress` and frontmatter `phase` equals it. When `status` is `done`, no phase is `in_progress` and `phase` stays `Crystallize`.

## Flow

| Phase | Always runs | Human interaction |
|-------|-------------|-------------------|
| Init | yes | ask only if the request is unclear |
| Prepare | yes | **1–5 checkpoint items before close (≥1 important question)** |
| Execute | only if the task changes files outside the vault | **explicit confirmation before implementing** |
| Verify | yes | report only |
| Crystallize | yes | none |

The only routing decision is made in Init: does this task change files outside the vault (repo code, config, docs, or other artifacts)? If yes, Execute starts `pending`; if no, Execute is `N/A` and must never be entered. There are no named routes.

## Human Gates

1. **Prepare checkpoint** (mandatory): analyze hidden assumptions, missing information, and the most common mistake; then present 1–5 checkpoint items to the user — at least one important question, the rest questions or risk points — and wait for the reply before finalizing the plan. See `references/prepare.md`.
2. **Execute gate** (mandatory for execution tasks): present what will change, which files are affected, risks, and the test plan; wait for explicit confirmation. Scope expansion requires a new gate.

## Subagent Policy

For tasks that change files outside the vault, implementation and verification must use separate agent invocations. If independent verification is unavailable, set task `blocked` and stop — never close Verify under a weakened policy.

### Concurrent writers

When several agents write at once, **their self-reported status is not evidence**. An agent that finishes while a sibling is mid-flight reports failures in files it does not own; the first to finish cannot see the others' final state. Re-run the project's full test / lint / typecheck on the merged tree yourself, and record that run — not the agents' summaries — as the evidence.

### What a verification pass must do

A pass that only checks the code against itself misses the defect that matters most. Each pass must:

1. **Re-read `plan.md` and check the implementation against it clause by clause.** The highest-yield defect class is an implementation that is internally consistent, fully green, and quietly narrower than the plan — a guard the plan defined as a conjunction implemented as one of its terms; a field the plan required declared but never populated.
2. **Re-derive every number the plan states** from source. Do not trust the plan document or an earlier pass for counts, paths, or line numbers.
3. **Try to falsify each test the implementation added**: name a change that would break behaviour and leave the test passing. If you can name one, the test does not guard what it claims.
4. **Check whether the fix has the shape of the bug.** A helper written to preserve surrounding context can drop exactly that context for a long input; a gate added to prevent a wrong route can make the right route unreachable.
5. **State what it could not verify**, instead of reporting a weaker check as an equivalent one.

Expect more than one pass. On the same artifact, the second and third passes find defects as consequential as the first — keep looping until a pass returns no blocking defect, and keep every pass's findings in `progress.md`.

## Persistence

- Task state lives in the vault under `10_tasks/<timestamp>/`. Code changes live in the repo. Never write code or config inside the vault.
- Accumulate findings and evidence in `progress.md` `## Findings` (there is no separate findings document). Every other task document — exported HTML, subagent reports, large analysis — is created inside the task folder `10_tasks/<timestamp>/`. Nothing else is written to other vault locations before Crystallize. Crystallize is the only phase that persists documents outside the task folder (to `20_research/` or `30_knowledge/`).
- Prefer `mdgraph_create_note` / `mdgraph_update_note` for all state writes so the index stays fresh. Filesystem fallback: write Markdown first, then run `mdgraph_sync`.
- If a safe write is impossible, set task `blocked` and stop. Never continue from memory-only state.

## Crystallize

Crystallize always completes. Long-term knowledge under `30_knowledge/` is optional — record `Knowledge crystallized: none` when nothing is reusable. Never modify skill or repo files during Crystallize.

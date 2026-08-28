---
name: mdgraph-loop
description: >-
  Lightweight loop-driven engineering workflow backed by mdgraph and KnowledgeVault.
  Init → Prepare → Execute (only when changes happen outside the vault) → Verify → Crystallize,
  with a one-question human checkpoint in Prepare and a confirmation gate before Execute.
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
| Prepare | yes | **exactly one question before close** |
| Execute | only if the task changes files outside the vault | **explicit confirmation before implementing** |
| Verify | yes | report only |
| Crystallize | yes | none |

The only routing decision is made in Init: does this task change files outside the vault (repo code, config, docs, or other artifacts)? If yes, Execute starts `pending`; if no, Execute is `N/A` and must never be entered. There are no named routes.

## Human Gates

1. **Prepare checkpoint** (mandatory): analyze hidden assumptions, missing information, and the most common mistake; then ask the user exactly one question and wait for the answer before finalizing the plan. See `references/prepare.md`.
2. **Execute gate** (mandatory for execution tasks): present what will change, which files are affected, risks, and the test plan; wait for explicit confirmation. Scope expansion requires a new gate.

## Subagent Policy

For tasks that change files outside the vault, implementation and verification must use separate agent invocations. If independent verification is unavailable, set task `blocked` and stop — never close Verify under a weakened policy.

## Persistence

- Task state lives in the vault under `10_tasks/<timestamp>/`. Code changes live in the repo. Never write code or config inside the vault.
- Accumulate findings and evidence in `progress.md` `## Findings` (there is no separate findings document). Every other task document — exported HTML, subagent reports, large analysis — is created inside the task folder `10_tasks/<timestamp>/`. Nothing else is written to other vault locations before Crystallize. Crystallize is the only phase that persists documents outside the task folder (to `20_research/` or `30_knowledge/`).
- Prefer `mdgraph_create_note` / `mdgraph_update_note` for all state writes so the index stays fresh. Filesystem fallback: write Markdown first, then run `mdgraph_sync`.
- If a safe write is impossible, set task `blocked` and stop. Never continue from memory-only state.

## Crystallize

Crystallize always completes. Long-term knowledge under `30_knowledge/` is optional — record `Knowledge crystallized: none` when nothing is reusable. Never modify skill or repo files during Crystallize.

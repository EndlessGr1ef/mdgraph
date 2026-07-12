---
name: mdgraph-loop
description: >-
  Loop-driven engineering workflow backed by mdgraph and KnowledgeVault.
  Orchestrates structured multi-phase task execution (Init→Explore→Plan→Execute→Verify→Crystallize)
  with subagent delegation and phase-gated transitions.
---

# mdgraph-loop

Phase references: `references/<phase>.md` — read the corresponding reference before starting that phase.
Templates: `templates/{task_plan,findings,progress}.md`
Workflow rules: `references/workflow.md` — read before entering any phase.

## Canonical State

`progress.md` is the single authoritative state record. Frontmatter (`status`, `phase`, `route`) owns task-level state. The `## Phase Progress` table owns per-phase status and completion dates. Supporting notes (`findings.md`, `task_plan.md`) never determine state.

While `status` is `in_progress` or `paused`, exactly one route phase is `in_progress` and frontmatter `phase` equals it. When `status` is `done`, no route phase is `in_progress` and frontmatter `phase` remains `Crystallize`.

## Routes

| Route | Phases |
|-------|--------|
| `implementation-simple` | Init → Execute → Verify → Crystallize |
| `implementation-planned` | Init → Explore → Plan → Execute → Verify → Crystallize |
| `non-execution` | Init → Explore → Verify → Crystallize |

Verify and Crystallize are mandatory. The `non-execution` route must never enter Execute.

## Phase Transition

Exactly one route phase is active at any time. Persist `progress.md` before crossing any phase boundary. Full transition rules (close steps, loopback override, commands, auto-advance exceptions) are defined in `references/workflow.md`.

## Gates

Before the first Execute entry and on any scope expansion, present a confirmation gate. The user must explicitly confirm before implementation begins. See `references/execute.md` for the gate protocol.

## Subagent Policy

For code-changing routes (`implementation-simple`, `implementation-planned`), implementation and verification must use separate agent invocations selected by capability. If independent verification is unavailable, set task `blocked` and stop — do not mark Verify complete under a weakened policy. This policy does not apply to `non-execution`.

## Crystallize

Crystallize always completes. Long-term knowledge creation under `30_knowledge/` is optional — record `Knowledge crystallized: none` when nothing is reusable. Never write workflow state outside the vault.

## Persistence

Task state files (`progress.md`, `findings.md`, `task_plan.md`) live in the vault under `10_tasks/`. Code changes live in the repo. The vault boundary applies to workflow state only — do not write code or config inside the vault.

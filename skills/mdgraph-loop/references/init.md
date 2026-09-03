---
name: mdgraph-loop-init
description: Init phase — frame the task, decide whether Execute applies, and create the progress note.
---

# Init Phase (`/loop-init`)

Create the task record and initialize the state machine.

## 1. Problem framing

- Read the user request.
- Check project-level `AGENTS.md` for work-type hints, but they never override the task itself.
- If the request is unclear, ask a clarifying question using the host's interactive question mechanism, or a plain message when none exists. Otherwise proceed without confirmation.

## 2. Decide whether Execute applies

Answer one binary question for yourself before creating files: **does this task change files outside the vault** (repo code, config, docs, or other artifacts)? Only ask the user if the answer is genuinely unclear.

- yes → Execute is part of the flow and starts `pending`.
- no (research, review, investigation, or vault-only writing) → Execute is `N/A` and must never be entered.

This is the only routing decision. Do not invent additional route categories.

## 3. Create the task record

- Create one timestamped folder under `10_tasks/`. This folder is the single home for every document this task will produce: `progress.md`, `plan.md`, and any other task documents (findings, evidence, exported HTML). Keep everything else inside this folder too — do not scatter task documents to other vault locations before Crystallize.
- Create `progress.md` from `templates/progress.md`, replacing placeholder frontmatter (id, title, description, phase, status, tags, created, updated) with actual values. No `route` field.
- Prefer `mdgraph_create_note`. Filesystem fallback: write the file, then run `mdgraph_sync`.
- Fill `## Goal`, `## Scope`, `## Constraints`, `## Success Criteria`.
- Set `## Phase Progress`: Init `in_progress`; Prepare `pending`; Execute `pending` or `N/A` from section 2; Verify `pending`; Crystallize `pending`. Write exactly one status per phase.

`progress.md` is the canonical task record. `plan.md` is created later in Prepare, only when needed.

## 4. Related task discovery

Search mdgraph for related tasks (`mdgraph_search`, project/feature keywords). If a directly relevant note id is already known (knowledge hub, prior task), fan out with `mdgraph_get_graph` (direction `both`, depth 1–2) to surface connected tasks and notes before searching. Reuse existing context when useful; add only relevant links, not broad dumps.

## 5. Close criteria

- Execute yes/no decided and reflected in Phase Progress (`pending` vs `N/A`).
- `progress.md` created with goal, scope, constraints, and success criteria.
- Phase Progress matches the decision.

Persist `progress.md`, then apply the Phase Transition rules in `references/workflow.md`.

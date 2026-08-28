---
name: mdgraph-loop-crystallize
description: Crystallize phase — summarize the task, persist reusable knowledge, and finish.
---

# Crystallize Phase (`/loop-crystallize`)

## 1. Summarize and record result

Extract from `progress.md` (including `## Findings`) and `plan.md`:
- changes made and files modified
- lessons learned, pitfalls encountered, patterns discovered
- reusable long-term knowledge

Write the summary to `progress.md` `## Result`.

## 2. Decide knowledge destination

Crystallize is the only phase that moves documents out of the task folder. All earlier task documents live under `10_tasks/<timestamp>/`; only here may they be routed to `20_research/` or `30_knowledge/`. Do not create knowledge/research notes in those locations during earlier phases.

If nothing is reusable, record `Knowledge crystallized: none` in `## Result` and skip to Close.

Otherwise search mdgraph for related documents (project name, feature name, key technical terms). Decide by **process vs end state** first: if the output is a reusable, stable conclusion (the answer / how-to), route to `30_knowledge/`. If the output is still an investigation — what was tried, sources, open questions, ongoing findings — route to `20_research/` (timestamped, `type: research`) instead. Then within `30_knowledge/`, decide by priority:

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | `30_knowledge/projects/<project>/` exists | Update or create a sub-file there |
| 2 | Related note in `30_knowledge/concepts/` or `30_knowledge/tools/` exists | Update that note |
| 3 | None of the above | Create a new file under `30_knowledge/` |

Vault-only rule: never modify workflow state files outside the vault; never modify vault files outside this workflow; never modify skill or repo files during Crystallize.

## 3. Update or create

- Prefer `mdgraph_update_note` / `mdgraph_create_note`; fallback is file write + `mdgraph_sync`.
- Update: merge into the relevant existing section, preserve overall structure, update `updated`.
- Create: use `30_knowledge/_template.md` as reference; semantic kebab-case filename (not a timestamp).
- Required frontmatter: `type`, `tags`, `created`, `updated`.
- Add `Source: [[task-id]]` in the body.

## 4. Link

- Knowledge note → task: `Source: [[task-id]]`
- `progress.md` `## Result` → knowledge note: `Knowledge crystallized: [[knowledge-id]]`

## 5. Close criteria

- Summary in `progress.md` `## Result`.
- Knowledge crystallized, or `Knowledge crystallized: none` recorded.
- Bidirectional links added when knowledge was created.

Mark Crystallize `complete` with date. Keep frontmatter `phase` as Crystallize. Set task `status` `done`. Persist `progress.md`. Do not invoke the ordinary Phase Transition — Crystallize is terminal.

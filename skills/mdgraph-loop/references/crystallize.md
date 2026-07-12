---
name: mdgraph-loop-crystallize
description: Crystallize phase — summarize task, persist knowledge, and finish.
---

# Crystallize Phase (`/loop-crystallize`)

## 1. Summarize and record result

Extract from progress.md, findings.md, task_plan.md:
- Changes made: what was done, which files were modified
- Lessons learned: pitfalls encountered, patterns discovered
- Reusable knowledge: what is worth preserving long-term

Write the summary to `progress.md` `## Result`.

## 2. Decide knowledge destination

If no reusable knowledge exists, record `Knowledge crystallized: none` in `## Result` and skip to Close.

Otherwise, use `mdgraph_search` to find related documents (project name, feature name, key technical terms), then decide destination by priority:

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Project knowledge dir exists `30_knowledge/projects/<project>/` | Update or create sub-file |
| 2 | Related concept exists `30_knowledge/concepts/` | Update the concept file |
| 3 | None of the above | Create new file in `30_knowledge/` |

Vault-only rule: never modify workflow state files (`progress.md`, `findings.md`, `task_plan.md`) outside the vault. Never modify vault files outside this workflow.

## 3. Update or Create

- **Update**: merge new content into the relevant existing section, preserve overall structure, update `updated` timestamp.
- **Create**: use `30_knowledge/_template.md` as reference, use semantic filenames (not timestamps).
- Required frontmatter: `type`, `tags`, `created`, `updated`.
- Add `Source: [[task-id]]` in body to link back to the task.

## 4. Link

Bidirectional links:
- Knowledge file → task: `Source: [[task-id]]`
- Task progress.md `## Result` → knowledge file: `Knowledge crystallized: [[knowledge-id]]`

## 5. Close criteria

- Task summary written to `progress.md` `## Result`.
- Knowledge crystallized or `Knowledge crystallized: none` recorded.
- Bidirectional links added if knowledge was created.

Mark Crystallize `complete` with date. Phase remains `Crystallize` — no next-phase advance. Set task status `done`. Persist `progress.md`. Do not invoke the ordinary Phase Transition — Crystallize is terminal and has no next phase.

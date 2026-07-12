---
name: mdgraph-loop-crystallize
description: Crystallize phase — summarize task, persist knowledge, and finish.
---

# Crystallize Phase (`/loop-crystallize`)

## 1. Summarize

Extract from progress.md, findings.md, task_plan.md:
- Changes made: what was done, which files were modified
- Lessons learned: pitfalls encountered, patterns discovered
- Reusable knowledge: what is worth preserving long-term

## 2. Search

Use `mdgraph_search` to find related documents:
- Project name, feature name, key technical terms
- Search both `30_knowledge/` and `10_tasks/`

## 3. Match

Decide knowledge destination by priority:

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Corresponding project skill exists | Update the skill |
| 2 | Project knowledge dir exists `30_knowledge/projects/<project>/` | Update or create sub-file |
| 3 | Related concept exists `30_knowledge/concepts/` | Update the concept file |
| 4 | None of the above | Create new file in `30_knowledge/` |

## 4. Update or Create

- **Update**: append new content, preserve existing structure, update `updated` timestamp
- **Create**: use `30_knowledge/_template.md` as reference, use semantic filenames (not timestamps)
- Required frontmatter: `type`, `tags`, `created`, `updated`
- Add `Source: [[task-id]]` in body to link back to the task

## 5. Link

Bidirectional links:
- Knowledge file → task: `Source: [[task-id]]`
- Task progress.md `## Result` → knowledge file: `Knowledge crystallized: [[knowledge-id]]`

## 6. Archive

- Update progress.md with crystallization results
- Update task_plan.md to mark Crystallize complete
- Set `status: done`

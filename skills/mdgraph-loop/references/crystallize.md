---
name: mdgraph-loop-crystallize
description: Crystallize phase — decide whether durable knowledge should be written and finish the task.
---

# Crystallize Phase (`/loop-crystallize`)

Persist durable knowledge if it exists, or record that none was produced.

## 1. Knowledge decision tree

Decide whether the work produced:

- a reusable concept, pattern, or gotcha
- investigation findings worth preserving
- an update to an existing note
- no durable knowledge

## 2. Durable knowledge path

If knowledge exists:

- create or update the vault note
- include `Source: [[task-id]]`
- add proper frontmatter and tags
- add a stable `source_task:` reference when useful
- update the task note `## Result` with `Knowledge crystallized: [[knowledge-note-id]]`

## 3. No knowledge path

If no durable knowledge exists:

- record `No durable knowledge produced` in the progress note
- do not create a knowledge note
- update the task note `## Result` with the no-knowledge conclusion

## 4. User confirmation

Ask the user to confirm the vault note content when one is written or updated, and apply requested adjustments before marking the phase done.

## 5. Finish

Mark Crystallize `✅ done`, set task status to `done`, and output the final summary. Crystallize has no outgoing transition.

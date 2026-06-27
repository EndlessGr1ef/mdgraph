---
name: mdgraph-loop-crystallize
description: Crystallize phase — decide whether durable knowledge should be written and finish the task.
---

# Crystallize Phase (`/loop-crystallize`)

Persist durable knowledge if it exists, or record that none was produced.

## 1. Knowledge classification

First, classify the knowledge produced by this task:

| Type | Vault destination | When |
|------|------------------|------|
| **Project knowledge** | `30_knowledge/projects/<project-name>.md` or `30_knowledge/projects/<project>/<topic>.md` | Task relates to a specific project (mdgraph, select-ai, glm-coding-helper, etc.) |
| **Concept / Pattern** | `30_knowledge/concepts/<concept-name>.md` | A reusable idea, technique, gotcha, or pattern not tied to one project |
| **Tool usage** | `30_knowledge/tools/<tool-name>.md` | How to use a specific tool, CLI flags, setup steps |
| **Person / contact** | `30_knowledge/people/<name>.md` | People metadata |
| **Research findings** | `20_research/` or inline in task note | Transient investigation detail not worth evergreen status |
| **Task record** | `10_tasks/<timestamp>_<name>.md` | Already exists — this IS the task note |
| **No durable knowledge** | — | Task produced nothing worth preserving beyond its own lifecycle |

## 2. Search-first protocol

**Before creating any new note, search the vault for existing related notes.**

Use `mdgraph_search` with multiple queries:
- project name, concept name, key terms
- check both `30_knowledge/projects/` and `30_knowledge/concepts/`

Decision:
- **If a relevant note exists** → update it with the new information. Append sections, add links, update timestamps.
- **If no relevant note exists** → create a new one in the correct directory using the appropriate template (`30_knowledge/projects/_template.md` or `30_knowledge/concepts/_template.md`).
- **If the knowledge spans multiple existing notes** → update all of them. Consider adding cross-links so they reference each other.

## 3. Consolidation over creation

**Default to updating an existing note. Only create a new note when no existing note is a reasonable home for the new knowledge.**

Guarding questions before creating a new note:
- Does an existing project or concept note already cover this topic?
- Could this information live as a section inside an existing note instead of a new file?
- Will this new note become a "second copy" of knowledge that belongs elsewhere?

If the answer to any is "yes", update the existing note instead.

## 4. Durable knowledge path

If knowledge exists and warrants its own note (or an update to an existing one):

- update the existing note, or create a new one in the correct vault location
- use the appropriate template as structure guide
- include `Source: [[task-id]]` in the note body
- add `source_task:` frontmatter reference when useful
- add proper frontmatter: `type`, `tags`, `aliases`, `created`/`updated`
- for `30_knowledge/` notes, use stable semantic filenames (not timestamps)
- for project sub-notes under `30_knowledge/projects/<project>/`, use descriptive filenames
- update the task note `## Result` with `Knowledge crystallized: [[knowledge-note-id]]`
- include cross-links to related notes

## 5. No knowledge path

If no durable knowledge exists:

- record `No durable knowledge produced` in the progress note
- do not create a knowledge note
- update the task note `## Result` with the no-knowledge conclusion

## 6. User confirmation

Ask the user to confirm the vault note content when one is written or updated, and apply requested adjustments before marking the phase done.

## 7. Finish

Mark Crystallize `✅ done`, set task status to `done`, and output the final summary. Crystallize has no outgoing transition.

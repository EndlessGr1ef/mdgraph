---
name: mdgraph-loop-crystallize
description: Crystallize phase — persist knowledge to vault with bidirectional wikilinks. Load this when the user says /loop-crystallize.
---

# Crystallize Phase (`/loop-crystallize`)

**Mandatory phase.** Persist durable knowledge into the vault.

## Steps

1. Evaluate what knowledge was produced:
   - New concept/pattern/gotcha → `30_knowledge/concepts/`
   - Investigation findings → `20_research/`
   - Updated understanding → update existing vault note
   - Project-specific → `30_knowledge/projects/`

2. Write knowledge note via `mdgraph_create_note`. Content MUST include `Source: [[task-id]]` wikilink. Include proper frontmatter, tags, and `source_task:` field.

3. Update task note: `mdgraph_update_note(id: task-id, content: ...)` — add `## Result` with `Knowledge crystallized: [[knowledge-id]]`.

4. Ask user for confirmation.

5. Update Phase Progress: Crystallize ✅. `mdgraph_update_note(id: task-id, status: "done")`.

6. No auto-transition. Output summary.

## Output

Vault note(s) with bidirectional wikilinks
---
name: engineering-phase-sink
description: Sink phase — crystallize knowledge to vault. This phase is mandatory. Load this when the user says /phase-sink.
---

# Sink Phase (`/phase-sink`)

**This phase is mandatory. Do not skip it.** This is where knowledge crystallizes into the vault — the core value of the entire workflow.

## Steps

1. Evaluate what knowledge was produced:
   - New concept/pattern/gotcha → `30_knowledge/concepts/<kebab-name>.md`
   - Investigation findings → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Updated understanding → update existing vault note
   - Project-specific knowledge → `30_knowledge/projects/<project>/<topic>.md`

2. Write the knowledge note via `mdgraph_create_note`. Content MUST include a `Source: [[task-id]]` wikilink back to the task. This creates a bidirectional edge enabling graph traversal. If MDGraph tools fail, write the file directly and call `mdgraph_sync` when available. Include:
   - Proper frontmatter (type, status, tags, created, updated)
   - At least one tag for the project/context
   - `[[wikilinks]]` to related vault notes

3. Update the task note to link to the knowledge note: `mdgraph_update_note(id: task-id, content: ...)` — add a `## Result` section with `Knowledge crystallized: [[knowledge-id]]`.

4. Ask user: "Written to vault: [note path]. Is the content correct?"

5. Update Phase Progress: Sink ✅
6. `mdgraph_update_note(id: task-id, status: "done")`
7. No auto-transition (workflow complete). Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes]
   - Key decisions: [summary from ## Decisions]
   ```

## Output

Vault note(s) with bidirectional wikilinks or "no durable knowledge"

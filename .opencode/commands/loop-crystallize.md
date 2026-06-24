---
description: "Phase 6/6: Sink — crystallize knowledge into vault with bidirectional wikilinks (mandatory phase, skip content only if no durable knowledge)"
---

Load and apply the `engineering-phase` skill, then load `references/sink.md` for detailed execution instructions.

Execute the **Sink** phase. **This phase is mandatory. Do not skip it.**

```text
Phase: Sink
Goal: preserve durable knowledge or record that none was produced
Writes: vault note(s) via mdgraph_create_note, task note (## Result + status → done)
```

1. **Read current state**: task note (`## Decisions`, `## Goal`) + findings note + progress note.

2. **Evaluate what knowledge was produced**:
   - New concept/pattern/gotcha → `30_knowledge/concepts/<kebab-name>.md`
   - Investigation findings → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Updated understanding → update existing vault note via `mdgraph_update_note`
   - Project-specific knowledge → `30_knowledge/projects/<project>/<topic>.md`

3. **If durable knowledge exists**: Write vault note via `mdgraph_create_note`. Content MUST include:
   - `Source: [[task-id]]` wikilink (bidirectional edge)
   - Proper frontmatter (type, status, tags, created, updated)
   - `source_task:` frontmatter field linking back to agent task folder path
   - At least one tag for the project/context
   - `[[wikilinks]]` to related vault notes

   If mdgraph MCP is unavailable, write file directly and call `mdgraph_sync` when available.

4. **Update task note**: `mdgraph_update_note(id: task-id, content: ...)` — add `## Result` with `Knowledge crystallized: [[knowledge-id]]`.

5. **If no durable knowledge**: record `"No durable knowledge produced"` in progress note.

6. **Ask user**: "Written to vault: [note path]. Is the content correct?" Only mark Sink done after confirmation.

7. **Update Phase Progress**: Sink ✅ + date. `mdgraph_update_note(id: task-id, status: "done")`.

8. **No auto-transition** — workflow complete. Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes]
   - Key decisions: [summary from ## Decisions]
   ```

Optional arguments (specific notes to sink, vault paths):
$ARGUMENTS

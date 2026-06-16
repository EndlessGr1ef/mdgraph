---
description: "Phase 6/6: Sink — crystallize knowledge into vault (optional/conditional, skip if no durable knowledge)"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Sink** phase. This phase is optional/conditional — only produce vault notes when durable reusable knowledge was created.

1. **Read current state**: Read canonical task file (`## Decisions`, `## Goal`) + `findings.md` + `progress.md`.

2. **Evaluate what knowledge was produced** by this task:
   - Is there a new concept, pattern, or gotcha worth preserving? → `30_knowledge/concepts/<kebab-name>.md`
   - Are there investigation findings worth referencing later? → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Does an existing note need updating? → update via `mdgraph_update_note`
   - Is there project-specific knowledge? → `30_knowledge/projects/<project>/<topic>.md`

3. **If durable reusable knowledge exists**: Write the vault note directly using `mdgraph_create_note` or file write. If MDGraph tools fail, write the file directly and call `mdgraph_sync` when available. Include:
   - Proper frontmatter (type, status, tags, created, updated)
   - `source_task:` frontmatter field linking back to the agent task folder path
   - At least one tag for the project/context
   - Wikilinks `[[related-note]]` to related vault notes
   - Source attribution (which task produced this knowledge)

4. **If no durable knowledge was produced**: Record `"No durable knowledge produced"` in `progress.md` and skip writing any vault note.

5. **Ask user**: "Written to vault: [note path]. Is the content correct? Any adjustments needed?" (Skip this if no note was written.)

6. **If adjustments are requested**: update the vault note, record the change in `progress.md`, and ask for confirmation again.

7. **Only after user confirmation** (or skip decision): update Phase Progress: Sink ✅ + date.

8. **Update canonical task status** → `done`.

9. **No auto-transition** — workflow complete. Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes, or "none"]
   - Key decisions: [summary from ## Decisions]
   ```

Optional arguments (specific notes to sink, vault paths):
$ARGUMENTS

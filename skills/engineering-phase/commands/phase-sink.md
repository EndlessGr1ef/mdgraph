---
description: "Phase 7/7: Sink — crystallize knowledge into vault (mandatory, cannot skip)"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Sink** phase. This phase is mandatory — it is where knowledge crystallizes into the vault, the core value of the entire workflow.

1. **Read current state**: Read canonical task file (`## Decisions`, `## Goal`) + `findings.md` + `progress.md`.

2. **Evaluate what knowledge was produced** by this task:
   - New concept/pattern/gotcha → `30_knowledge/concepts/<kebab-name>.md`
   - Investigation findings → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Updated understanding of existing note → update via `mdgraph_update_note`
   - Project-specific knowledge → `30_knowledge/projects/<project>/<topic>.md`

3. **Write the vault note directly** using `mdgraph_create_note` or file write. If MDGraph tools fail, write the file directly and call `mdgraph_sync` when available. Include:
   - Proper frontmatter (type, status, tags, created, updated)
   - `source_task:` frontmatter field linking back to the agent task folder path
   - At least one tag for the project/context
   - Wikilinks `[[related-note]]` to related vault notes
   - Source attribution (which task produced this knowledge)

4. **Ask user**: "Written to vault: [note path]. Is the content correct? Any adjustments needed?"

5. **Update Phase Progress**: Sink ✅ + date

6. **Update canonical task status** → `done`

7. **No auto-transition** — workflow complete. Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes]
   - Key decisions: [summary from ## Decisions]
   ```

Optional arguments (specific notes to sink, vault paths):
$ARGUMENTS

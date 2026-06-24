---
description: "Phase 6/6: Crystallize — persist knowledge to vault with bidirectional wikilinks (mandatory)"
---

Load and apply the `mdgraph-loop` skill, then load `references/crystallize.md` for detailed instructions.

First, **Detect**: `mdgraph_search(status: "in_progress", tag: "agent-task")` to find active task. If none, ask user to run `/loop-init` first.

Execute the **Crystallize** phase. **This phase is mandatory.**

```text
Phase: Crystallize
Goal: preserve durable knowledge or record none produced
Writes: vault note(s) via mdgraph_create_note, task note (## Result + status → done)
```

1. **Read state**: task note + findings + progress.

2. **Evaluate knowledge produced**: concept → `30_knowledge/concepts/`, findings → `20_research/`, update → `mdgraph_update_note`.

3. **If durable knowledge exists**: `mdgraph_create_note` with `Source: [[task-id]]` wikilink, proper frontmatter, tags. If MCP unavailable, write file directly + `mdgraph_sync`.

4. **Update task note**: `mdgraph_update_note(id: task-id)` — add `## Result` + `Knowledge crystallized: [[knowledge-id]]`.

5. **If no durable knowledge**: record in progress note and skip.

6. **Ask user for confirmation**. Only mark done after confirmation.

7. Phase Progress: Crystallize ✅. `mdgraph_update_note(id: task-id, status: "done")`.

8. **No auto-transition**. Output summary.

Optional arguments (specific notes, vault paths):
$ARGUMENTS
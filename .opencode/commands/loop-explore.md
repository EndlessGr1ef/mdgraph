---
description: "Phase 2/6: Explore — gather evidence via codegraph, mdgraph traversal, tavily (optional, skippable)"
---

Load and apply the `mdgraph-loop` skill, then load `references/explore.md` for detailed instructions.

First, **Detect**: `mdgraph_search(status: "in_progress", tag: "agent-task")` to find active task. If none, ask user to run `/loop-init` first.

Execute the **Explore** phase:

```text
Phase: Explore
Goal: gather evidence and write findings
Writes: findings.md (via mdgraph_update_note), progress.md
```

1. **Read current state**: `mdgraph_get_note(id: task-id)` → parse Phase Progress → follow wikilinks.

2. **Choose strategy** by work type:
   - Investigation: codegraph callers/callees + logs + `mdgraph_search` → `mdgraph_get_graph` → `mdgraph_search(tag:)`
   - Migration: codegraph compare + `mdgraph_search` → graph traversal → tag search
   - Implementation: codegraph explore + tavily + `mdgraph_search` → `mdgraph_get_graph` → tag search
   - Review: impact analysis + diff + `mdgraph_search(tag:)` → `mdgraph_get_graph`
   - Knowledge-gap: `mdgraph_search` + `mdgraph_get_graph(depth:2)` + tag search + tavily

   **Maker (dispatch to @explorer)**: For large scope, spawn `@explorer` separately. For small, do directly.

3. **Write findings**: `mdgraph_update_note(id: findings-id)`. Include `[[wikilinks]]` to related notes.

4. **Maker/checker (conditional)**: If large scope, spawn `@oracle` separately to validate coverage.

5. **When substantive**: Update Phase Progress: Explore ✅. Auto-transition.

Optional arguments (search queries, focus areas):
$ARGUMENTS
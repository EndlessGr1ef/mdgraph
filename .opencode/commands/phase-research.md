---
description: "Phase 2/6: Research — gather evidence via codegraph, mdgraph traversal, tavily; write findings (optional, skippable)"
---

Load and apply the `engineering-phase` skill, then load `references/research.md` for detailed execution instructions.

Execute the **Research** phase:

```text
Phase: Research
Goal: gather evidence and write findings
Writes: findings.md (via mdgraph_update_note), progress.md
```

1. **Read current task state**: Find the active agent task folder. `mdgraph_get_note(id: task-id)` → parse `## Phase Progress` and follow wikilinks to deliverable notes.

2. **Choose exploration strategy** based on work type from `## Problem Statement`:
   - **Investigation**: codegraph trace (callers/callees) + log reading + `mdgraph_search` for similar past issues → `mdgraph_get_graph(id: hit.id, depth: 2, direction: "both")` for each hit → `mdgraph_search(tag: relevant-tag)` for concept discovery
   - **Migration**: codegraph compare source vs target + `mdgraph_search` for migration notes → graph traversal from hits → `mdgraph_search(tag: relevant-tag)` for related migration patterns
   - **Implementation**: codegraph explore existing system + tavily for library docs + `mdgraph_search` + `mdgraph_get_graph` for prior similar implementations → `mdgraph_search(tag: relevant-tag)` for related concepts
   - **Review**: codegraph impact analysis + diff reading + `mdgraph_search(tag: project-tag)` → `mdgraph_get_graph` from hits
   - **Knowledge-gap**: `mdgraph_search` + `mdgraph_get_graph(depth: 2)` + `mdgraph_search(tag: relevant-tag)` + tavily

   **Maker (dispatch recon to @explorer)**: For large or unfamiliar scope, spawn `@explorer` (separate session) to gather findings in parallel. For small/known scope, do the recon directly.

3. **Write findings**: `mdgraph_update_note(id: findings-id, content: ...)`. Include `[[wikilinks]]` to related notes discovered during graph traversal.

4. **Maker/checker (conditional)**: If scope is large or unfamiliar, spawn `@oracle` in a **separate session** to validate research coverage. Skip checker for single-file known-area research.

5. **Completion criteria**: findings.md has at least 3 sections with code references, config values, or log excerpts; OR contains `## Definitive Finding` with a clear resolution statement.

6. **Update Phase Progress**: Research ✅ + date via `mdgraph_update_note(id: task-id)`

7. **Auto-transition**: prompt next applicable phase.

Optional arguments (search queries, specific areas to focus on):
$ARGUMENTS

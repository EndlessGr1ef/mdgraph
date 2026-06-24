---
name: engineering-phase-research
description: Research phase — gather evidence via codegraph + mdgraph traversal. Load this when the user says /phase-research.
---

# Research Phase (`/phase-research`)

Gather evidence and write findings. Graph-aware: use `mdgraph_get_graph` to traverse from search hits and discover related decisions/concepts.

## Steps

1. Based on work type, choose exploration strategy:
   - **Investigation**: codegraph trace (callers/callees) + log reading + `mdgraph_search` for similar past issues → then `mdgraph_get_graph(id: hit.id, depth: 2, direction: "both")` for each search hit to discover related decisions and concepts → `mdgraph_search(tag: relevant-tag)` for concept discovery
   - **Migration**: codegraph compare (source vs target) + `mdgraph_search` for migration notes → graph traversal from hits → `mdgraph_search(tag: relevant-tag)` for related migration patterns
   - **Implementation**: codegraph explore (existing system) + tavily (library docs if needed) + `mdgraph_search` + `mdgraph_get_graph` for prior similar implementations → `mdgraph_search(tag: relevant-tag)` for related concepts
   - **Review**: codegraph impact analysis + diff reading + `mdgraph_search(tag: project-tag)` for context → `mdgraph_get_graph` from hits
   - **Knowledge-gap**: `mdgraph_search` + `mdgraph_get_graph(depth: 2)` + `mdgraph_search(tag: relevant-tag)` + tavily

   **Maker (dispatch recon to @explorer)**: For large or unfamiliar scope, spawn `@explorer` (separate session) to gather findings in parallel — it is 2x faster and 1/2 cost. For small/known scope, do the recon directly.

2. Write all findings into the findings note via `mdgraph_update_note(id: findings-id, content: ...)`. Include `[[wikilinks]]` to related notes discovered during graph traversal.

3. **Maker/checker (conditional)**: If scope is large or unfamiliar, spawn `@oracle` in a **separate session** to validate research coverage:
   - Prompt: "Review the findings note. Did we miss any subsystem? Are there related past decisions we didn't check? Is the evidence sufficient to proceed?"
   - If oracle surfaces gaps → feed back into findings note via `mdgraph_update_note`
   - If oracle confirms coverage → proceed
   - Skip checker for single-file known-area research (see Sub-agent Token Budget)

4. When findings are substantive (at least 3 sections with code references, config values, or log excerpts; OR a section explicitly marked `## Definitive Finding` with a clear resolution statement):
   - Update Phase Progress: Research ✅
   - Auto-transition: prompt next applicable phase

## Output

Findings note via `mdgraph_update_note`

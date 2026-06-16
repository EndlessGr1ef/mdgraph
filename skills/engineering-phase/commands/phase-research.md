---
description: "Phase 2/7: Research — gather evidence via codegraph, tavily, vault search; write findings.md"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Research** phase:

1. **Read current task state**: Find the active agent task folder (most recent `10_agentTasks/` entry with status `in_progress`, or from conversation context). Read the canonical task file and `## Phase Progress`.

2. **Choose exploration strategy** based on work type from `## Problem Statement`:
   - **Investigation**: `codegraph` trace (callers/callees/impact) + log/config reading + `mdgraph_search` for similar past issues
   - **Migration**: `codegraph` compare source vs target + `mdgraph_search` for migration notes + diff analysis
   - **Implementation**: `codegraph` explore existing system + `tavily` for library docs if needed
   - **Review**: `codegraph` impact analysis + diff reading + `mdgraph_search` for related decisions
   - **Knowledge-gap**: `mdgraph_search` + `tavily` web research

3. **Execute exploration**: Run searches in parallel where possible. Write ALL findings into `findings.md` in the task folder:
   - Each finding: what was found, where, significance
   - Evidence: code paths, config values, log patterns, vault references
   - Open questions remaining

4. **Completion criteria**: findings.md has at least 3 sections with code references, config values, or log excerpts; OR contains a section explicitly marked `## Definitive Finding` with a clear resolution statement.

5. **Update Phase Progress**: Research ✅ + date

6. **Auto-transition**: Find next applicable phase (first `⬜ pending` after Research) and prompt:
   ```
   ✅ Research complete → next: /phase-[next] ([purpose])
   Proceed? [yes/skip/stop/abort]
   ```
   - **yes** → execute next phase inline
   - **skip** → only offered if next phase is skippable; mark as `⏭️ skipped`, prompt the one after
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (search queries, specific areas to focus on):
$ARGUMENTS

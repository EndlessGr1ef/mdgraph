---
description: "Phase 1/6: Init — create task, create mdgraph note cluster, scope work"
---

Load and apply the `engineering-phase` skill, then load `references/init.md` for detailed execution instructions.

Execute the **Init** phase:

```text
Phase: Init
Goal: confirm the task, classify scale, create the task workspace and mdgraph note cluster
Writes: task note (spine), findings.md, plan.md, progress.md
```

1. **Parse the user's task**: Check project-level `AGENTS.md` for project-specific keyword mappings. If no project mapping exists, default to the full phase chain.

2. **Clarify the task**:
   - If the task description is fuzzy or ambiguous, load `socratic-question` skill if available. Use its Phase 1 (Problem Reframing) to deconstruct the user's description. If unavailable, ask concise inline clarification questions.
   - If the task description is already clear, do a lightweight confirmation with the user — restate the goal and get a nod.

3. **Output structured problem statement**:
   ```markdown
   ## Problem Statement
   - **Type**: [investigation | migration | implementation | review | knowledge-gap]
   - **Scope**: [what systems/files/areas are involved]
   - **Boundary**: [what's in scope, what's out of scope]
   - **Key question**: [the one question that, if answered, resolves this]
   ```

4. **Create task note cluster** via mdgraph (4 indexed notes connected by wikilinks):

   a. **Task note** (spine): `mdgraph_create_note`
      - path: `10_tasks/{timestamp}_{slug}/{slug}.md`
      - type: `agent_task`, status: `in_progress`
      - tags: `[agent-task, ...context-tags]`
      - content: Goal + Scope + Context + Phase Progress + Success Criteria

   b. **Findings note**: `mdgraph_create_note`
      - path: `10_tasks/{timestamp}_{slug}/findings.md`
      - type: `research`, status: `active`
      - tags: `[findings, ...context-tags]`
      - content: `Task: [[{task-id}]]` + `(Awaiting research phase)`

   c. **Plan note**: `mdgraph_create_note`
      - path: `10_tasks/{timestamp}_{slug}/plan.md`
      - type: `agent_task`, status: `active`
      - tags: `[plan]`
      - content: `Task: [[{task-id}]]` + `(Awaiting plan phase)`

   d. **Progress note**: `mdgraph_create_note`
      - path: `10_tasks/{timestamp}_{slug}/progress.md`
      - type: `agent_task`, status: `active`
      - tags: `[progress]`
      - content: `Task: [[{task-id}]]` + `## Session Log`

   e. Discover related work: `mdgraph_search(query: {keywords}, tag: "agent-task", status: "in_progress")`

   f. Add wikilinks to discovered related tasks in the task note's `## Context` section via `mdgraph_update_note`. Also add the task slug as an `aliases` field on the task note so `[[slug]]` resolves.

   If mdgraph MCP is unavailable, fall back to direct file writes and call `mdgraph_sync` when available.

5. **Auto-transition**: Find next applicable phase (first `⬜ pending` after Init) and prompt:
    ```
    ✅ Init complete → next: /phase-[next] ([purpose])
    Updated: [files]
    Key points: [problem statement, task scale, next phase]
    Proceed? [yes/skip/stop/abort]
    ```
   - **yes** → execute next phase inline
   - **skip** → only offered if next phase is skippable; mark as `⏭️ skipped`, prompt the one after
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

User task:
$ARGUMENTS

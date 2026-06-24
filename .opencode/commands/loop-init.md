---
description: "Phase 1/6: Init — create task, create mdgraph note cluster, scope work"
---

Load and apply the `mdgraph-loop` skill, then load `references/init.md` for detailed instructions.

Execute the **Init** phase:

```text
Phase: Init
Goal: confirm the task, classify scale, create the workspace and mdgraph note cluster
Writes: task note (spine), findings.md, plan.md, progress.md
```

1. **Parse the user's task**: Check project-level `AGENTS.md` for keyword mappings. Default to full loop path.

2. **Clarify the task**:
   - If fuzzy, load `socratic-question` skill. Use Phase 1 (Problem Reframing). If unavailable, ask inline.
   - If clear, lightweight confirmation with the user.

3. **Output structured problem statement** with type, scope, boundary, key question.

4. **Create task note cluster** via mdgraph (4 indexed notes connected by wikilinks):

   a. Task note (spine): `mdgraph_create_note` — path `10_tasks/{timestamp}_{slug}/{slug}.md`, type `agent_task`, status `in_progress`
   b. Findings note: `mdgraph_create_note` — path `10_tasks/{timestamp}_{slug}/findings.md`, type `research`, status `active`
   c. Plan note: `mdgraph_create_note` — path `10_tasks/{timestamp}_{slug}/plan.md`, type `agent_task`, status `active`
   d. Progress note: `mdgraph_create_note` — path `10_tasks/{timestamp}_{slug}/progress.md`, type `agent_task`, status `active`
   e. `mdgraph_search(query: {keywords}, tag: "agent-task", status: "in_progress")` for related work
   f. Add wikilinks to related tasks via `mdgraph_update_note`

   If mdgraph MCP unavailable, write files directly and call `mdgraph_sync` when available.

5. **Auto-transition**: prompt next applicable phase:
    ```
    ✅ Init complete → next: /loop-[next] ([purpose])
    Proceed? [yes/skip/stop/abort]
    ```

User task:
$ARGUMENTS
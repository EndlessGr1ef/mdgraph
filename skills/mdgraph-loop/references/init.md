---
name: engineering-phase-init
description: Init phase — create task, create mdgraph note cluster, scope work. Load this when the user says /phase-init or starts a new engineering task.
---

# Init Phase (`/phase-init`)

Create the task spine, scope the work, and launch the mdgraph note cluster.

## Steps

1. Parse user description to identify work type hint:
   - Check project-level `AGENTS.md` for project-specific keyword mappings
   - If no project mapping exists, default to full 6-phase path

2. Load `socratic-question` skill. Use Phase 1 (Problem Reframing) to deconstruct the user's description.

3. After convergence, output structured problem statement:
   ```markdown
   ## Problem Statement
   - **Type**: [investigation | migration | implementation | review | knowledge-gap]
   - **Scope**: [what systems/files/areas are involved]
   - **Boundary**: [what's in scope, what's out of scope]
   - **Key question**: [the one question that, if answered, resolves this]
   ```

4. Create task note cluster via mdgraph (4 indexed notes):

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

5. Auto-transition: prompt next applicable phase (typically `/phase-research`)

## Output

Problem statement + mdgraph task note cluster (4 notes)

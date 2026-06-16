---
description: "Phase 1/7: Framing — deconstruct the problem, create task folder (socratic-question + vault task)"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Create Task** phase:

1. **Parse work type**: Check project-level `AGENTS.md` for project-specific keyword mappings. If no project mapping exists, default to full 7-phase path.

2. **Framing with socratic-question**: Load `socratic-question` skill. Use its Phase 1 (Problem Reframing) to deconstruct the user's task description. Do NOT jump to code exploration or implementation. The goal is a clear problem statement.

3. **Output problem statement**:
   ```markdown
   ## Problem Statement
   - **Type**: [investigation | migration | implementation | review | knowledge-gap]
   - **Scope**: [what systems/files/areas are involved]
   - **Boundary**: [what's in scope, what's out of scope]
   - **Key question**: [the one question that, if answered, resolves this]
   ```

4. **Create agent task folder** following knowledge-vault's Agent task workflow:
   - Generate timestamp: `date +%Y%m%d_%H%M%S`
   - Create: `MyKnowledgeBase/10_agentTasks/{timestamp}_{kebab-name}/`
   - Create canonical task file: `{kebab-name}.md` with:
     - Problem statement in `## Goal`
     - Work type in `## Context`
     - Initialize `## Phase Progress` table based on work type routing (mark N/A phases upfront)
   - Create planning files: `task_plan.md`, `findings.md`, `progress.md`
   - Update Phase Progress: Create Task ✅

5. **Auto-transition**: Find next applicable phase (first `⬜ pending` after Create Task) and prompt:
   ```
   ✅ Create Task complete → next: /phase-[next] ([purpose])
   Proceed? [yes/skip/stop/abort]
   ```
   - **yes** → execute next phase inline
   - **skip** → only offered if next phase is skippable; mark as `⏭️ skipped`, prompt the one after
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

User task:
$ARGUMENTS

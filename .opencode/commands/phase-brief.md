---
description: "Phase 1/6: Brief — create/confirm task brief, create task folder and planning files"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **Brief** phase:

Start with a short terminal-visible note:

```text
Phase: Brief
Goal: confirm the task, classify scale, and create the task workspace
Writes: canonical task file, task_plan.md, findings.md, progress.md
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

   Also classify task scale as `Small`, `Medium`, or `Large`.

4. **Create agent task folder** following knowledge-vault's Agent task workflow:
   - Generate timestamp: `date +%Y%m%d_%H%M%S`
   - Resolve `<vault-root>` from the active vault configuration, MDGraph MCP status, explicit user path, or the user's configured KnowledgeVault path.
   - Create: `<vault-root>/10_tasks/{timestamp}_{kebab-name}/`
   - Create canonical task file: `{kebab-name}.md` using this shape:
     ```markdown
     ---
     id: 10_tasks_{timestamp}_{kebab-name}
     title: [Task Title]
     type: agent_task
     status: in_progress
     tags: [agent-task]
     aliases: []
     created: YYYY-MM-DD
     updated: YYYY-MM-DD
     ---

     # [Task Title]

     ## Goal

     [problem statement]

     ## Scope

     - In scope: ...
     - Out of scope: ...

     ## Constraints

     - ...

      ## Success Criteria

      - ...

      ## Context

      - Work type: [investigation | migration | implementation | review | knowledge-gap]
      - Task scale: [Small | Medium | Large]
      - Related planning files:
        - `task_plan.md`
        - `findings.md`
        - `progress.md`

      ## Phase Progress

      | Phase | Status | Completed |
      |-------|--------|-----------|
      | Brief | ✅ done | YYYY-MM-DD |
      | Research | ⬜ pending / N/A | - |
      | Plan | ⬜ pending / N/A | - |
      | Implement | ⬜ pending / N/A | - |
      | Verify | ⬜ pending | - |
      | Sink | ⬜ pending / N/A | - |

      ## Decisions

      ## Result

      ## Follow-ups
     ```
   - Initialize `## Phase Progress` based on work type routing (mark N/A phases upfront)
   - Create planning files: `task_plan.md`, `findings.md`, `progress.md`
   - Record the phase exit checklist summary in `progress.md`
   - Update Phase Progress: Brief ✅

5. **Auto-transition**: Find next applicable phase (first `⬜ pending` after Brief) and prompt:
    ```
    ✅ Brief complete → next: /phase-[next] ([purpose])
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

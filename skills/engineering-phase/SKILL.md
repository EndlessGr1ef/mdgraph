---
name: engineering-phase
description: Phase-aware engineering workflow orchestration. Triggers on /phase-* commands. Manages the Brief→Research→Plan→Implement→Verify→Sink lifecycle with automatic phase transition prompting. Do NOT trigger for casual questions, quick lookups, or simple edits that don't need structured phases.
---

# Engineering Phase Workflow

Orchestrates the 6-phase engineering workflow defined in the `knowledge-vault` skill. This skill handles phase transitions, deliverable validation, skill routing, and automatic next-phase prompting. It does NOT implement any phase itself — it delegates to existing skills.

OpenCode slash commands for this workflow live in `.opencode/commands/phase-*.md`. Keep command prompts there, not inside this skill directory.

## Phase definitions

See `knowledge-vault` skill's "Engineering Workflow Phases" section for full definitions. Summary:

| Phase | Command | Skill | Deliverable | Transition condition |
|-------|---------|-------|-------------|---------------------|
| Brief | `/phase-brief` | `socratic-question` or inline framing fallback | Problem statement + task folder | Task confirmed + user agrees |
| Research | `/phase-research` | `codegraph` + `tavily` + `mdgraph_search` | `findings.md` | findings has substantive content |
| Plan | `/phase-plan` | direct; `planning-with-files` optional | `task_plan.md` with work graph | Plan written + user confirms |
| Implement | `/phase-implement` | `deepwork` or direct | Code changes | Verification criteria met |
| Verify | `/phase-verify` | direct checklist; external reviewer optional | Verification report | All checks pass or loop decision made |
| Sink | `/phase-sink` | `mdgraph_create_note` | Vault note(s) or "no durable knowledge" | Note written + confirmed, or skip recorded |

## Phase Progress initialization

When Brief determines the work type, initialize `## Phase Progress` based on the routing table. Mark non-applicable phases as `N/A` upfront — do not list them as "pending".

Example for **investigation** type (Brief → Research → Plan → Implement → Verify → Sink):

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Brief | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| Plan | ⬜ pending | - |
| Implement | ⬜ pending | - |
| Verify | ⬜ pending | - |
| Sink | ⬜ pending | - |
```

Example for **review** type (Brief → Research → Verify → Sink):

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Brief | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| Plan | N/A | - |
| Implement | N/A | - |
| Verify | ⬜ pending | - |
| Sink | ⬜ pending | - |
```

## Auto-transition protocol

After every phase completes, the agent MUST:

1. Update `## Phase Progress` in the canonical task file (mark current phase ✅ done + date)
2. Find the next applicable phase (first phase after current with status `⬜ pending`; skip `N/A` phases)
3. Output the transition prompt:

```text
✅ [current phase] complete → next: /phase-[next-applicable-phase] ([purpose])
Proceed? [yes/stop/abort]
```

Options:
- **yes**: load and execute the next phase command's instructions inline
- **stop**: stop phase flow, return to normal conversation (task remains `in_progress`)
- **abort**: mark task as cancelled, set canonical task status → `cancelled`, write brief reason to `progress.md`

If the next phase is **skippable** (see skip conditions in knowledge-vault), add a `skip` option:

```text
✅ [current phase] complete → next: /phase-[next-applicable-phase] ([purpose])
Proceed? [yes/skip/stop/abort]
```

- **skip**: mark the next phase as `⏭️ skipped` in Phase Progress, advance to the one after, and prompt again

If the next phase is **mandatory** (Plan, Implement, Verify), do NOT offer skip — only `yes/stop/abort`.

## Phase orchestration

### 1. Brief (`/phase-brief`)

1. Parse user description to identify work type hint:
   - Check project-level `AGENTS.md` for project-specific keyword mappings
   - If no project mapping exists, default to full 6-phase path

2. Load `socratic-question` skill if available. Use Phase 1 (Problem Reframing) to deconstruct fuzzy descriptions. If unavailable or if the task is already clear, ask concise inline clarification questions or simply confirm.

3. After convergence, output structured problem statement:
   ```markdown
   ## Problem Statement
   - **Type**: [investigation | migration | implementation | review | knowledge-gap]
   - **Scope**: [what systems/files/areas are involved]
   - **Boundary**: [what's in scope, what's out of scope]
   - **Key question**: [the one question that, if answered, resolves this]
   ```

4. Create agent task folder (following knowledge-vault's Agent task workflow):
   - Timestamp: `date +%Y%m%d_%H%M%S`
   - Folder: `<vault-root>/10_tasks/{timestamp}_{kebab-name}/`
   - Files: `{kebab-name}.md`, `task_plan.md`, `findings.md`, `progress.md`
   - Write problem statement into canonical task file's `## Goal`
   - Initialize `## Phase Progress` table based on work type routing (mark N/A phases)

5. Auto-transition: prompt next applicable phase (typically `/phase-research`)

### 2. Research (`/phase-research`)

1. Based on work type, choose exploration strategy:
   - **Investigation**: codegraph trace (callers/callees) + log reading + vault search for similar past issues
   - **Migration**: codegraph compare (source vs target) + vault search for migration notes
   - **Implementation**: codegraph explore (existing system) + tavily (library docs if needed)
   - **Review**: codegraph impact analysis + diff reading
   - **Knowledge-gap**: mdgraph_search + tavily

2. Write all findings into `findings.md`.

3. When findings are substantive (at least 3 sections with code references, config values, or log excerpts; OR a section explicitly marked `## Definitive Finding` with a clear resolution statement):
   - Update Phase Progress: Research ✅
   - Auto-transition: prompt `/phase-plan` next

### 3. Plan (`/phase-plan`)

1. Based on Brief's problem statement and any Research findings, break work into tasks. Use `planning-with-files` if available; otherwise write `task_plan.md` directly.
2. Write `task_plan.md` with:
   - Work graph: ordered task list with clear dependencies
   - Lanes: parallel work tracks where possible
   - Each task: description, files involved, dependencies, verification criteria
   - Risk areas and complexity estimates flagged
3. Update Phase Progress: Plan ✅
4. Auto-transition: prompt `/phase-implement` (mandatory, no skip)

### 4. Implement (`/phase-implement`)

Choose implementation approach based on task complexity:

| Condition | Approach |
|-----------|----------|
| Single-file fix, < 20 lines | Direct implementation |
| Multi-step but sequential, < 5 files | Sequential: work through task_plan items one by one, verify each before proceeding |
| Complex, multi-file, risky | `deepwork` with oracle review gates |

Track task IDs during implementation. Log each sub-task and status in `progress.md`.

After all tasks complete:
- Reconcile cross-task conflicts
- Run full verification against task_plan criteria
- If verification passes → update Phase Progress: Implement ✅ → auto-transition: prompt `/phase-verify`
- If verification fails → loop back within Implement (re-fix, re-verify). Max 3 attempts before asking user.

### 5. Verify (`/phase-verify`)

1. Review changes or findings against available phase inputs:
   - If `task_plan.md` exists and Plan is applicable, verify every plan item.
   - If Plan is N/A, verify against `findings.md`, `## Goal`, and the scope from Brief.
   - For critical/risky changes → use an external reviewer skill if available.
   - For straightforward changes → direct review checklist:
     - [ ] Changes or findings match the goal and decisions
     - [ ] All applicable task_plan items are addressed, or Plan is N/A with a documented reason
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled or noted as out of scope

2. Record verification results in `progress.md`.

3. If verification fails:
   - Report issues clearly
   - Offer to loop back to Plan (design/approach issue) or Implement (implementation bug)
   - Do NOT auto-advance to Sink until verification passes

4. Update Phase Progress: Verify ✅
5. Auto-transition: prompt `/phase-sink`

### 6. Sink (`/phase-sink`)

**This phase is optional/conditional.** Only produce vault notes when durable reusable knowledge was created.

1. Evaluate what knowledge was produced:
   - New concept/pattern/gotcha → `30_knowledge/concepts/<kebab-name>.md`
   - Investigation findings → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Updated understanding → update existing vault note
   - Project-specific knowledge → `30_knowledge/projects/<project>/<topic>.md`

2. If durable knowledge exists, write the note directly using `mdgraph_create_note` or file write. If MDGraph tools fail, write the file directly and call `mdgraph_sync` when available. Include:
   - Proper frontmatter (type, status, tags, created, updated)
   - `source_task:` frontmatter field linking back to the agent task folder
   - At least one tag for the project/context
   - Wikilinks to related vault notes

3. If no durable knowledge was produced, record `"No durable knowledge produced"` in `progress.md`.

4. Ask user for confirmation if a note was written. After confirmation (or skip decision), update Phase Progress: Sink ✅

5. Update canonical task status → `done`

6. No auto-transition (workflow complete). Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes, or "none"]
   - Key decisions: [summary from ## Decisions]
   ```

## Resume behavior

When resuming a task (reading an existing agent task folder):
1. Read the canonical task file first.
2. Read `## Phase Progress` table to find the last completed phase.
3. Resume from the next applicable phase (first `⬜ pending` after last ✅ done).
4. If Phase Progress is missing, enter Brief phase to re-initialize.
5. If phase deliverables are missing but marked done, re-enter that phase.

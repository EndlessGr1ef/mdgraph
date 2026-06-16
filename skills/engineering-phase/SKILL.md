---
name: engineering-phase
description: Phase-aware engineering workflow orchestration. Triggers on /phase-* commands. Manages the Create Task→Research→PRD→Plan→Execution→QA→Sink lifecycle with automatic phase transition prompting. Do NOT trigger for casual questions, quick lookups, or simple edits that don't need structured phases.
---

# Engineering Phase Workflow

Orchestrates the 7-phase engineering workflow defined in the `knowledge-vault` skill. This skill handles phase transitions, deliverable validation, skill routing, and automatic next-phase prompting. It does NOT implement any phase itself — it delegates to existing skills.

## Phase definitions

See `knowledge-vault` skill's "Engineering Workflow Phases" section for full definitions. Summary:

| Phase | Command | Skill | Deliverable | Transition condition |
|-------|---------|-------|-------------|---------------------|
| Create Task | `/phase-create-task` | `socratic-question` | Problem statement + task folder | Problem statement clear + user confirms |
| Research | `/phase-research` | `codegraph` + `tavily` + `mdgraph_search` | `findings.md` | findings has substantive content |
| PRD | `/phase-prd` | `socratic-question` | Decision record in task file | User confirms approach |
| Plan | `/phase-plan` | (direct) | `task_plan.md` with breakdown | Plan written + user confirms |
| Execution | `/phase-execution` | `deepwork` or direct | Code changes | Verification passes |
| QA | `/phase-qa` | `adversarial-reviewer` | Verification report | All checks pass |
| Sink | `/phase-sink` | `mdgraph_create_note` | Vault note(s) + wikilinks | Note written + user confirmed |

## Phase Progress initialization

When Create Task determines the work type, initialize `## Phase Progress` based on the routing table. Mark non-applicable phases as `N/A` upfront — do not list them as "pending".

Example for **investigation** type (Create Task → Research → PRD → Execution → QA → Sink):

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Create Task | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| PRD | ⬜ pending | - |
| Plan | N/A | - |
| Execution | ⬜ pending | - |
| QA | ⬜ pending | - |
| Sink | ⬜ pending | - |
```

Example for **review** type (Create Task → Research → QA → Sink):

```markdown
## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Create Task | ✅ done | 2026-06-16 |
| Research | ⬜ pending | - |
| PRD | N/A | - |
| Plan | N/A | - |
| Execution | N/A | - |
| QA | ⬜ pending | - |
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

If the next phase is **mandatory** (QA, Sink, Execution), do NOT offer skip — only `yes/stop/abort`.

## Phase orchestration

### 1. Create Task (`/phase-create-task`)

1. Parse user description to identify work type hint:
   - Check project-level `AGENTS.md` for project-specific keyword mappings
   - If no project mapping exists, default to full 7-phase path

2. Load `socratic-question` skill. Use Phase 1 (Problem Reframing) to deconstruct the user's description.

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
   - Folder: `MyKnowledgeBase/10_agentTasks/{timestamp}_{kebab-name}/`
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
   - Auto-transition: prompt next applicable phase

### 3. PRD (`/phase-prd`)

1. Review `findings.md` from Research phase.
2. If multiple approaches exist:
   - Use `socratic-question` Phase 2 (Deep Exploration) to surface trade-offs
   - Present approaches as structured options
3. If only one approach is viable:
   - State the approach and why alternatives don't apply
4. Write decision record into canonical task file's `## Decisions` section:
   ```markdown
   ## Decisions
   - **Chosen approach**: [approach name]
   - **Why**: [reasoning]
   - **Alternatives rejected**: [list + why]
   - **Risks**: [known risks]
   - **Scope confirmation**: [what's in, what's out]
   ```
5. Update Phase Progress: PRD ✅
6. Auto-transition: prompt next applicable phase

### 4. Plan (`/phase-plan`)

1. Based on PRD decisions, break work into tasks.
2. Write `task_plan.md` with:
   - Ordered task list with dependencies
   - Each task: description, files involved, verification criteria
   - Risk areas flagged
3. Update Phase Progress: Plan ✅
4. Auto-transition: prompt next applicable phase (typically `/phase-execution`)

### 5. Execution (`/phase-execution`)

Choose execution mode based on task complexity:

| Condition | Mode |
|-----------|------|
| Single-file fix, < 20 lines | Direct implementation |
| Multi-step but sequential, < 5 files | Sequential implementation: work through task_plan items one by one, verify each before proceeding |
| Complex, multi-file, risky | `deepwork` with oracle review gates |

After implementation + verification:
- If verification passes → update Phase Progress: Execution ✅ → auto-transition: prompt `/phase-qa`
- If verification fails → loop back within Execution (re-fix, re-verify). Max 3 attempts before asking user.

### 6. QA (`/phase-qa`)

1. Review code changes against PRD decisions and task_plan:
   - For critical/risky changes → use `adversarial-reviewer` skill
   - For straightforward changes → direct review checklist:
     - [ ] Changes match PRD decisions
     - [ ] All task_plan items addressed
     - [ ] No regressions in touched areas
     - [ ] Edge cases handled

2. Record verification results in `progress.md`.

3. If verification fails → report issues, offer to loop back to Execution.

4. Update Phase Progress: QA ✅
5. Auto-transition: prompt `/phase-sink` (mandatory, no skip offered)

### 7. Sink (`/phase-sink`)

**This phase is mandatory. Do not skip it.** This is where knowledge crystallizes into the vault — the core value of the entire workflow.

1. Evaluate what knowledge was produced:
   - New concept/pattern/gotcha → `30_knowledge/concepts/<kebab-name>.md`
   - Investigation findings → `20_research/<original-task-timestamp>_<kebab-name>.md`
   - Updated understanding → update existing vault note
   - Project-specific knowledge → `30_knowledge/projects/<project>/<topic>.md`

2. Write the note directly using `mdgraph_create_note` or file write. If MDGraph tools fail, write the file directly and call `mdgraph_sync` when available. Include:
   - Proper frontmatter (type, status, tags, created, updated)
   - `source_task:` frontmatter field linking back to the agent task folder
   - At least one tag for the project/context
   - Wikilinks to related vault notes

3. Ask user: "Written to vault: [note path]. Is the content correct?"

4. Update Phase Progress: Sink ✅
5. Update canonical task status → `done`
6. No auto-transition (workflow complete). Output summary:
   ```
   🏁 Task complete!
   - Agent task: [task path] (status: done)
   - Vault notes: [list of created/updated notes]
   - Key decisions: [summary from ## Decisions]
   ```

## Resume behavior

When resuming a task (reading an existing agent task folder):
1. Read the canonical task file first.
2. Read `## Phase Progress` table to find the last completed phase.
3. Resume from the next applicable phase (first `⬜ pending` after last ✅ done).
4. If Phase Progress is missing, enter Create Task phase to re-initialize.
5. If phase deliverables are missing but marked done, re-enter that phase.

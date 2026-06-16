---
description: "Phase 3/7: PRD — decide WHAT to do using socratic-question for trade-off analysis"
---

Load and apply the `engineering-phase` skill before doing anything else.

Execute the **PRD** phase:

1. **Read current state**: Read the active agent task's canonical task file + `findings.md`. Understand what evidence is available.

2. **If multiple approaches exist**:
   - Load `socratic-question` skill
   - Use its Phase 2 (Deep Exploration) to surface trade-offs between approaches
   - Present approaches as structured options: assumption, reasoning, risk, applicability
   - Let user converge on one approach

3. **If only one approach is viable**:
   - State the approach and why alternatives don't apply
   - Ask user to confirm

4. **Write decision record** into the canonical task file's `## Decisions` section:
   ```markdown
   ## Decisions
   - **Chosen approach**: [approach name]
   - **Why**: [reasoning from findings]
   - **Alternatives rejected**: [list + brief reason]
   - **Risks**: [known risks from analysis]
   - **Scope confirmation**: [what's in, what's out]
   ```

5. **Update Phase Progress**: PRD ✅ + date

6. **Auto-transition**: Find next applicable phase (first `⬜ pending` after PRD) and prompt:
   ```
   ✅ PRD complete → next: /phase-[next] ([purpose])
   Proceed? [yes/skip/stop/abort]
   ```
   - **yes** → execute next phase inline
   - **skip** → only offered if next phase is skippable; mark as `⏭️ skipped`, prompt the one after
   - **stop** → return to normal conversation (task stays `in_progress`)
   - **abort** → set task status to `cancelled`, write reason to `progress.md`

Optional arguments (specific decisions to make, constraints):
$ARGUMENTS

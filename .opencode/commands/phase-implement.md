---
description: "Phase 4/6: Implement — execute plan, dispatch specialist lanes, maker/checker review"
---

Load and apply the `engineering-phase` skill, then load `references/implement.md` for detailed execution instructions.

Execute the **Implement** phase:

```text
Phase: Implement
Goal: execute the approved plan and verify each task
Writes: code files, progress.md (via mdgraph_update_note)
```

1. **Read current state**: `mdgraph_get_note(id: plan-id)` + task note `## Decisions`.

2. **Choose execution mode** based on task complexity:

   | Condition | Mode |
   |-----------|------|
   | Single-file fix, < 20 lines | Direct implementation |
   | Multi-step but sequential, < 5 files | Sequential: work through plan items one by one, verify each before proceeding |
   | Complex, multi-file, risky | `deepwork` with oracle review gates |

3. **Implement** following plan note order:
   - After each plan item, log progress to the progress note via `mdgraph_update_note`
   - **Maker/checker (always for non-trivial items)**: spawn `@oracle` in a **separate session** for inline review
     - If oracle surfaces issues → feed back to `@fixer` for fixes, then re-review
     - If oracle approves → proceed to next plan item
     - Exception: trivial < 20-line single-file changes may self-review

4. **After implementation**:
   - If verification passes → update Phase Progress: Execution ✅ → auto-transition: prompt `/phase-verify`
   - If verification fails → loop back within Execution (re-fix, re-verify). Max 3 attempts before asking user.

Optional arguments (specific tasks to execute, verification focus):
$ARGUMENTS

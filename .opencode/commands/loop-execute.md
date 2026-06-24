---
description: "Phase 4/6: Execute — implement code changes, maker/checker review"
---

Load and apply the `mdgraph-loop` skill, then load `references/execute.md` for detailed instructions.

First, **Detect**: `mdgraph_search(status: "in_progress", tag: "agent-task")` to find active task. If none, ask user to run `/loop-init` first.

Execute the **Execute** phase:

```text
Phase: Execute
Goal: implement the approved plan and verify each task
Writes: code files, progress.md (via mdgraph_update_note)
```

1. **Read state**: `mdgraph_get_note(id: plan-id)` + task note `## Decisions`.

2. **Choose mode**:
   - Single-file < 20 lines → direct
   - Multi-step < 5 files → sequential, verify each
   - Complex/risky → `deepwork` with oracle gates

3. **Implement** following plan order. Log progress via `mdgraph_update_note`. **Maker/checker**: spawn `@oracle` separately for inline review. Exception: < 20-line changes self-review.

4. **After**: Pass → Phase Progress: Execute ✅ → `/loop-verify`. Fail → loop back, max 3 attempts.

Optional arguments (specific tasks, verification focus):
$ARGUMENTS
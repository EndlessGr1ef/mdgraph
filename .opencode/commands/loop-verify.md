---
description: "Phase 5/6: Verify — run checks, goal convergence check, loop on failure"
---

Load and apply the `mdgraph-loop` skill, then load `references/verify.md` for detailed instructions.

First, **Detect**: `mdgraph_search(status: "in_progress", tag: "agent-task")` to find active task. If none, ask user to run `/loop-init` first.

Execute the **Verify** phase:

```text
Phase: Verify
Goal: verify outputs against goal, check convergence
Writes: progress.md (via mdgraph_update_note), task status → review
```

1. **Read state**: task note + findings + plan + progress notes.

2. **Review** against PRD decisions and plan:
   - Critical → `adversarial-reviewer` skill
   - Straightforward → direct checklist

3. **Oracle reconciliation** (if adversarial-reviewer used): spawn `@oracle` to reconcile.

4. **Goal convergence check**: Does output meet `## Success Criteria`?
   - Not converged → `/loop-explore` or `/loop-execute`
   - Converged → proceed

5. Record results. Update task status → `review`. Phase Progress: Verify ✅ → `/loop-crystallize`.

Optional arguments (verification focus):
$ARGUMENTS
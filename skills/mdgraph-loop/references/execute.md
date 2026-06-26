---
name: mdgraph-loop-execute
description: Execute phase — implement the approved plan and log progress.
---

# Execute Phase (`/loop-execute`)

Implement the approved plan and keep the progress note current.

## 1. Choose mode

Pick the lightest mode that fits the work:

- direct edits for tiny bounded changes
- sequential edits for small multi-step work
- deepwork for complex or risky changes

## 2. Load state

Read the task note, the plan note, and the progress note before editing.

## 3. Execute tasks

Work through the ordered plan items and log meaningful progress after each step.

## 4. Failed attempt behavior

If a step fails:

- record the failure in the progress note
- adjust the approach before retrying
- do not repeat the same failed action immediately

## 5. Review policy

Apply the shared Subagent Policy for risky or multi-file work.

## 6. Close

Close using the shared Close Phase Protocol.

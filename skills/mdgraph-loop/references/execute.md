---
name: mdgraph-loop-execute
description: Execute phase — implement code changes with maker/checker. Load this when the user says /loop-execute.
---

# Execute Phase (`/loop-execute`)

Implement code changes, log progress.

## Steps

1. Choose mode by complexity:

   | Condition | Mode |
   |-----------|------|
   | Single-file, < 20 lines | Direct |
   | Multi-step, < 5 files | Sequential, verify each before next |
   | Complex, multi-file, risky | `deepwork` with oracle review gates |

2. After each plan item, log progress via `mdgraph_update_note`.

3. **Maker/checker (always)**: Spawn `@oracle` in separate session for inline review. Exception: < 20-line changes may self-review.

4. After implementation:
   - Pass → Phase Progress: Execute ✅ → `/loop-verify`
   - Fail → loop back (re-fix, re-verify). Max 3 attempts.

## Output

Code changes + progress note updates
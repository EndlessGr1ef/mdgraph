---
name: engineering-phase-implement
description: Implementation phase — dispatch specialist lanes, implement, reconcile. Load this when the user says /phase-implement.
---

# Implement Phase (`/phase-implement`)

Dispatch specialist lanes, implement code changes, log progress.

## Steps

1. Choose execution mode based on task complexity:

   | Condition | Mode |
   |-----------|------|
   | Single-file fix, < 20 lines | Direct implementation |
   | Multi-step but sequential, < 5 files | Sequential implementation: work through plan note items one by one, verify each before proceeding |
   | Complex, multi-file, risky | `deepwork` with oracle review gates |

2. After each plan item is implemented, log progress to the progress note via `mdgraph_update_note`.

3. **Maker/checker (always for non-trivial items)**: After each plan item, spawn `@oracle` in a **separate session** for inline review:
   - Prompt: "Review the changes for plan item [N]. Does this match the PRD decisions? Are there regressions in touched areas? Any edge cases missed?"
   - If oracle surfaces issues → feed back to `@fixer` for fixes, then re-review
   - If oracle approves → proceed to next plan item
   - Exception: trivial < 20-line single-file changes may self-review (see Sub-agent Token Budget)

4. After implementation + verification:
   - If verification passes → update Phase Progress: Execution ✅ → auto-transition: prompt `/phase-verify`
   - If verification fails → loop back within Execution (re-fix, re-verify). Max 3 attempts before asking user.

## Output

Code changes + progress note updates

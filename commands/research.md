---
description: "Standalone research — gather evidence and summarize findings without entering the phase workflow"
---

Execute a **standalone research** task. This command is separate from `/phase-research` and MUST NOT update `## Phase Progress` or auto-transition into Plan/Implement.

Research topic:
$ARGUMENTS

## Behavior

1. **Clarify scope only if needed**
   - If the topic is ambiguous, ask one concise clarification question.
   - Otherwise proceed directly.

2. **Choose sources based on the topic**
   - Codebase behavior → CodeGraph first, then targeted file reads.
   - Local memory / prior decisions → `mdgraph_search` or vault search.
   - External libraries / current docs → web research with official docs preferred.
   - Bug reports / tricky behavior → combine code search, docs, examples, and known issues.

3. **Run research efficiently**
   - Parallelize independent searches where possible.
   - Prefer primary sources and concrete evidence over generic summaries.
   - Capture file paths, symbols, URLs, versions, and dates when relevant.

4. **Return a concise research report**
   ```markdown
   ## Research Summary

   [short answer / current best understanding]

   ## Evidence

   - [source/path/url] — [what it shows]

   ## Implications

   - [what this means for the user/project]

   ## Open Questions

   - [only if still unresolved]

   ## Suggested Next Step

   - [one recommended next action]
   ```

5. **Vault sinking is optional**
   - If the result is likely reusable, ask: `Save this research to <vault-root>/20_research/?`
   - If the user says yes, write a timestamped research note using KnowledgeVault rules.
   - If the research should become implementation work, suggest `/phase-brief` instead of silently entering the phase workflow.

## Constraints

- Do not create or modify `10_tasks/` task folders unless the user explicitly asks to convert the research into a phase workflow task.
- Do not update Phase Progress.
- Do not auto-transition to `/phase-plan` or `/phase-implement`.

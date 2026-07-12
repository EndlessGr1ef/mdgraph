---
name: mdgraph-loop
description: >-
  Loop-driven engineering workflow backed by mdgraph and KnowledgeVault.
  Orchestrates structured multi-phase task execution (Init→Explore→Plan→Execute→Verify→Crystallize)
  with subagent delegation and phase-gated transitions.
---

# mdgraph-loop

Phase references: `references/<phase>.md` — must read the corresponding phase reference before starting that phase.
Templates: `templates/{task_plan,findings,progress}.md`
## Rules
- Resolve the current phase first, then read only its reference file.
- Markdown in the vault is the source of truth, use `mdgraph` mcp to search & update.
- Implementation and verification must use separate subagent runs.
## 1. Loop

`Init → Explore? → Plan? → Execute → Verify → Crystallize`

- `Explore` and `Plan` are optional for simple tasks.
- Entering `Execute` requires user confirmation.
- Failed verification returns to `Execute` or `Explore`.
- `Crystallize` is terminal and sets `status: done`.

Task note frontmatter: `phase` (current phase), `status` (`in_progress`/`done`, only `done` when all phases complete or user requests). `## Phase Progress` values: `pending`, `skipped`, `N/A`.

## 3. State Machine

- **Entry**: search mdgraph for `tag: "agent-task"` + `status: in_progress` → resume first `pending` phase. No match → search by context keywords. Still none → `/loop-init`. MCP unavailable → read Markdown directly.
- **Phase finish**: confirm close criteria → record completion date in `## Phase Progress` `Completed` column → update `phase` frontmatter to next → prompt user (`yes`/`stop`/`abort`/`skip`) → load next reference file.
- **Gates**: Execute requires confirmation before implementation. Crystallize sets `status: done`, no outgoing transition.

## 4. Persistence

Markdown is the source of truth. After each phase completes, update all task-related md files (progress, findings, plan). Never write outside the vault root.



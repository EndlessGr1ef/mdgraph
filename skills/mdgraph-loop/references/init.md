---
name: mdgraph-loop-init
description: Init phase — create the task cluster, classify the route, and set initial phase progress.
---

# Init Phase (`/loop-init`)

Create the task spine, classify the work, and initialize the note cluster.

## 1. Problem framing

- Read the user request.
- Check project-level `AGENTS.md` for any work-type keyword hints.
- If the request is unclear, use `socratic-question` for reframing to resolve ambiguity. Otherwise proceed without confirmation.
- Decide the route before creating notes.

## 2. Canonical task record

Create one timestamped task folder under `10_tasks/` and create these notes inside it:

- `slug.md` — task spine
- `findings.md`
- `plan.md`
- `progress.md`

Create the task note as the canonical record below.

```markdown
---
id: 10_tasks_yyyymmdd_hhmmss_short-kebab-name
title: Task Title
type: agent_task
status: in_progress
tags: [agent-task]
aliases: [short-kebab-name]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Task Title

## Goal

## Scope

## Context

Findings: [[{findings-note-id}]]
Plan: [[{plan-note-id}]]
Progress: [[{progress-note-id}]]

## Constraints

## Success Criteria

## Phase Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| Init | ✅ done | YYYY-MM-DD |
| Explore | {⬜ pending or N/A} | - |
| Plan | {⬜ pending or N/A} | - |
| Execute | {⬜ pending or N/A} | - |
| Verify | {⬜ pending or N/A} | - |
| Crystallize | ⬜ pending | - |

## Progress

## Decisions

## Result

## Follow-ups
```

## 3. Note cluster creation

- Task note: `type: agent_task`, `status: in_progress`
- Findings note: `type: research`, `status: active`
- Plan note: `type: agent_task`, `status: active`
- Progress note: `type: agent_task`, `status: active`
- Link every deliverable back to the task note with `Task: [[task-id]]`.
- Add related task wikilinks to `## Context` when discovered.
- Add the slug to `aliases` so `[[slug]]` resolves.

## 4. Initial phase progress

- Mark phases that are not in the route as `N/A`.
- Mark phases in the route as `⬜ pending`.
- Mark Init as `✅ done`.
- Leave Crystallize as `⬜ pending` because it is always applicable.
- Do not write combined placeholder values such as `⬜ pending / N/A` into the real task note; choose exactly one allowed status per phase.

## 5. Related task discovery

Search for related active tasks and reuse existing context when useful. Add only relevant links, not broad dumps.

## 6. Close

Close using the shared Close Phase Protocol.

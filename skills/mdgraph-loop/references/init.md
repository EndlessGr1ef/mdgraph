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

## 2. Create files

Create one timestamped task folder under `10_tasks/` and create these notes inside it (copy from `templates/` in the skill directory):

- `task_plan.md` — from `templates/task_plan.md`
- `findings.md` — from `templates/findings.md`
- `progress.md` — from `templates/progress.md` (add frontmatter: `phase`, `status`, `tags: [agent-task]`)

`progress.md` is the canonical task record. It owns: phase, status, goal, scope, constraints, success criteria, phase progress, decisions, result.

## 4. Initial phase progress

- Mark phases that are not in the route as `N/A`.
- Mark phases in the route as `pending`.
- Mark Init as `in_progress` with the current date in the `Completed` column.
- Leave Crystallize as `pending` because it is always applicable.
- Do not write combined placeholder values such as `pending / N/A` into the real task note; choose exactly one allowed status per phase.

## 5. Related task discovery

Search for related active tasks and reuse existing context when useful. Add only relevant links, not broad dumps.

## 6. Close

Close.

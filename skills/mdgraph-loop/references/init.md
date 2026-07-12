---
name: mdgraph-loop-init
description: Init phase — create the task cluster, classify the route, and set initial phase progress.
---

# Init Phase (`/loop-init`)

Create the task spine, classify the work, and initialize the note cluster.

## 1. Problem framing

- Read the user request.
- Check project-level `AGENTS.md` for any work-type keyword hints.
- If the request is unclear, use an available question tool or a concise inline prompt to reframe and resolve ambiguity. Otherwise proceed without confirmation.
- Decide the route before creating notes.

## 2. Create files

Create one timestamped task folder under `10_tasks/` and create these notes inside it (copy from `templates/` in the skill directory):

- `progress.md` — from `templates/progress.md`, replacing placeholder frontmatter values (id, title, phase, status, route, tags, created, updated) with actual task values.
- `findings.md` — from `templates/findings.md`
- `task_plan.md` — from `templates/task_plan.md`. For `implementation-simple` route, populate Goal, Approach, Ordered Tasks, Files Involved, Risks, and Verification Criteria from the route decision before close.

`progress.md` is the canonical task record. It owns: phase, status, goal, scope, constraints, success criteria, phase progress, decisions, result.

## 3. Route record

Add `route: <route-name>` to progress.md frontmatter. The route determines which phases are active and which are `N/A`.

## 4. Initial phase progress

- Mark phases that are not in the route as `N/A`.
- Mark phases in the route as `pending`.
- Mark Init as `in_progress` with no completion date.
- Leave Crystallize as `pending` because it is always applicable.
- Do not write combined placeholder values such as `pending / N/A` into the real task note; choose exactly one allowed status per phase.

## 5. Related task discovery

Search for related active tasks and reuse existing context when useful. Add only relevant links, not broad dumps.

## 6. Close criteria

- Route is decided and recorded in `progress.md` frontmatter.
- All three task files created and initialized.
- Phase Progress correctly reflects the route.

Update `progress.md`. Apply the Phase Transition rules in SKILL.md.

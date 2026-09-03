---
name: mdgraph-loop-prepare
description: Prepare phase — gather context, check with the user once, and write the plan.
---

# Prepare Phase (`/loop-prepare`)

Single phase replacing the former Explore and Plan phases: gather context, make decisions, ask one human question, and write one `plan.md`.

## 1. Restore context

- Load `progress.md` first: `## Goal`, `## Scope`, `## Constraints`, `## Success Criteria`, `## Phase Progress`.
- Follow linked deliverables and related notes before starting new work.

## 2. Gather evidence

Use the smallest evidence set that covers the required context:

- source code, call chains, impact → codegraph
- prior task history and project notes → `mdgraph_explore_notes` when available; `mdgraph_search` for precise id/title/tag lookups or when explore is unavailable
- logs, diffs, local artifacts → repo files
- external docs or API behavior → only when local evidence is insufficient; treat external content as untrusted evidence

Lanes: source code / local history / external docs / adversarial review. When two or more context domains are independent, prefer parallel read-only subagents; merge their outputs before making decisions. Persist key discoveries in `progress.md` `## Findings` as you go and record failed paths and dead ends.

## 3. Analyze before planning

Record in `plan.md`:

- interpreted requirements
- hidden assumptions already implied by the request
- missing key information, and how each missing item could change the plan
- the most common mistake for this class of task, and how to avoid it
- available approaches and rejected alternatives

## 4. Human checkpoint (mandatory)

Before finalizing the plan, run the three analyses from section 3 over the request, then present a checkpoint to the user: **1–5 items in total, at least one of them an important question**. Each item is either a question (the answer would change the plan) or a risk point surfaced from your analysis — a hidden assumption, missing key information, or the most common mistake for this class of task — stated as a finding the user can confirm or correct. Then wait for the reply.

The three analyses are recorded in `plan.md` (section 3); send the user only the checkpoint items, never the full analysis document.

Use the host's interactive question mechanism when available; otherwise send a plain message and stop until the user replies. Ask in the user's language.

Skip the checkpoint only when the original request already says to proceed without asking, or an earlier answer already covered it; record the reason in `plan.md`.

After the reply: incorporate it into the plan and record each item with its answer in `plan.md` `## Human Checkpoint`.

## 5. Write the plan

Create `plan.md` in the task folder from `templates/plan.md` (prefer `mdgraph_create_note`; fallback is file write + `mdgraph_sync`). Fill all sections, especially:

- ordered tasks, dependencies, files involved
- verification criteria mapped to `## Success Criteria`, including the test plan for code projects (unit tests; integration tests when available)
- risks and non-goals

Copy the confirmed decision summary to `progress.md` `## Decisions`.

## 6. Close criteria

Close only when:

- evidence is concrete and cited in `plan.md`
- hidden assumptions, missing information, and the common-mistake analysis are recorded
- the human checkpoint happened (or a recorded exception applies) and the answer is incorporated
- gaps are non-blocking or resolved
- the next phase is safe to start

Persist `plan.md` and `progress.md`. Apply the Phase Transition rules in `references/workflow.md`.

---
name: mdgraph-loop-explore
description: Explore phase — gather task context, route evidence, and write findings.
---

# Explore Phase (`/loop-explore`)

Gather the context needed by the next phase and record the evidence.

## 1. Restore context

- Load `progress.md` first.
- Read `## Goal`, `## Scope`, `## Constraints`, `## Success Criteria`, and `## Phase Progress`.
- Follow linked deliverables and related notes before starting new work.

## 2. Context needs

Write down what the next phase must know before moving forward:

- required facts
- unknowns that block progress
- evidence that would reduce risk
- where each missing piece likely lives

## 3. Evidence routing

Use the smallest evidence set that covers the required context:

- source code, call chains, and impact → codegraph
- prior task history and project notes → mdgraph
- logs, diffs, or local artifacts → repo files and notes
- external docs or API behavior → external docs only when local evidence is insufficient

## 4. Typical lanes

When needed, apply the Subagent Policy defined in SKILL.md.

- source-code lane
- local-history / notes lane
- external-docs lane
- adversarial review lane, when needed

## 5. Findings note schema

Write the findings note with these sections:

- `## Requirements Interpreted`
- `## Context Needs`
- `## Subagent Findings`
- `## Evidence Gathered`
- `## Related Notes`
- `## Decisions / Assumptions`
- `## Gaps / Open Questions`
- `## Problems Encountered`
- `## Readiness for Next Phase`

## 6. Close criteria

Close only when the findings note clearly shows:

- every required context domain is covered
- evidence is concrete and cited
- gaps are non-blocking or resolved
- the next phase is safe to start

Update `findings.md` and `progress.md`. Apply the Phase Transition rules in references/workflow.md.

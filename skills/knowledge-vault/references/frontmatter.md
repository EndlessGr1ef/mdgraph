# Frontmatter Convention

## Standard Fields

```yaml
---
id: stable-note-id
title: Human Readable Title
description: One sentence summary (≤80 chars recommended)
type: knowledge
status: active
tags: []
aliases: []
resource: Optional external URI or path
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Rules:

- Use stable `id` — MDGraph and agents use `id` for retrieval. Do not change `id` unless the user explicitly requests an ID migration; when changing it, update all wikilinks/backlinks that reference the old id.
- Use `description` as a one-sentence search preview, ≤80 characters when practical.
- `resource` links to a canonical external asset (GitHub repo, project path, API endpoint, docs page, dashboard). Omit for purely abstract notes.
- Unknown frontmatter keys are allowed; preserve them when updating notes.

## type Values (role/category only)

```
inbox       agent_task   research    plan
concept     project      person
tool        knowledge
```

`inbox` means capture-bucket role; use `status: draft` for unorganized lifecycle state. `plan` is produced by mdgraph-loop task plans. Other values also in active use (daily, daily-analysis, findings, progress, reference) are allowed; for new notes prefer the closest role listed above.

## status Values (lifecycle only)

```
draft        # just captured, not yet organized
active       # in use, maintained
in_progress  # actively being implemented
review       # waiting for review
done         # finished, no longer actively updated
cancelled    # intentionally stopped before completion
archived     # archived, no longer active
```

mdgraph-loop task records use the lifecycle values above plus three workflow-control extensions:

```
paused       # loop: task paused mid-phase, resumable
blocked      # loop: state conflict or unsafe write; requires explicit repair
aborted      # loop: task intentionally cancelled
```

Do not encode lifecycle into `type`. Use `type: research` + `status: archived` instead of `type: research-archive`.

## OKF-Inspired Conventions

- Each Markdown file = one knowledge concept/note.
- Keep `type` non-empty on all real notes. MDGraph can fall back to `note`, but producers should write explicit types.

- Prefer `resource` when anchored to an external/canonical asset.
- Unknown frontmatter keys are allowed; preserve them.
- Broken links are warnings, not failures. They may represent planned notes.

## Conventional Sections (guidance, not requirements)

```
## Summary / ## 一句话总结
## Context / ## 背景
## Examples / ## 示例
## Sources / ## 来源
## Citations / ## 引用
## Related Notes / ## 相关笔记
```

For research notes, prefer `## Sources` for source list and `## Citations` for citing specific claims. For durable knowledge, prefer `## Related Notes` for internal wikilinks.

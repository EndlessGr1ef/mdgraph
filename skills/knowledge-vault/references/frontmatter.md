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

- Use stable `id` — MDGraph and agents use `id` for retrieval. Do not change casually; changing breaks references unless links are updated deliberately.
- `description` should be a compact one-sentence summary for search previews and generated indexes.
- `resource` links to a canonical external asset (GitHub repo, project path, API endpoint, docs page, dashboard). Omit for purely abstract notes.
- Unknown frontmatter keys are allowed; preserve them when updating notes.

## type Values (role/category only)

```
inbox       agent_task   research
concept     project      person
tool        knowledge
```

`inbox` means capture-bucket role; use `status: draft` for unorganized lifecycle state.

## status Values (lifecycle only)

```
draft        # just captured, not yet organized
active       # in use, maintained
in_progress  # actively being implemented
review       # waiting for review
done         # finished, no longer actively updated
archived     # archived, no longer active
```

Do not encode lifecycle into `type`. Use `type: research` + `status: archived` instead of `type: research-archive`.

## OKF-Inspired Conventions

- Each Markdown file = one knowledge concept/note.
- Keep `type` non-empty on all real notes. MDGraph can fall back to `note`, but producers should write explicit types.
- Prefer `description` for one-sentence summaries.
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
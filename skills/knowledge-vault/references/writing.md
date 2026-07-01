# Writing Guidelines

## General Rules

- Use one `#` title, then `##` section headings; keep generated paragraphs to 1–5 lines and omit filler introductions.
- Preserve user-owned content; do not overwrite existing Markdown unless the task is explicitly an update.
- Prefer wikilinks for relationships: `[[mdgraph]]`, `[[local-first]]`.
- For research notes, include a `## Sources` section with URLs, file paths, command outputs, or note links sufficient to re-check each major claim.
- Do not store secrets, API keys, credentials, private tokens, or sensitive personal data unless the user explicitly instructs and the storage location is appropriate.
- If creating an agent task record, include goal, context, decisions, progress, result, and follow-ups.

## Research Note Shape

For `20_research/`, prefer:

```markdown
---
id: research-short-id
title: Research Title
type: research
status: active
tags: [research]
aliases: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Research Title

## Question

## Sources

## Findings

## Claims

## Open Questions

## Related Notes
```

Use `status: in_progress` for ongoing investigations; `status: active` for maintained reference notes.

## Common Pitfalls

- Do not put durable long-lived knowledge in `00_inbox/` forever; promote it to `30_knowledge/` once stable and add `tags: [evergreen]`.
- Do not create untimestamped files in `00_inbox/`, `10_tasks/`, `20_research/`, or `90_archive/` except `_template.md`.
- Do not treat `.mdgraph/*.db` as authoritative data.
- Do not rely on template notes as real knowledge; templates are ignored by MDGraph indexing.
- Do not overwrite notes just because a generated title collides; search first and choose update vs new note deliberately.

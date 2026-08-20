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

## Crystallization

When a `20_research/` investigation reaches a reusable, stable conclusion, crystallize that conclusion into `30_knowledge/` (semantic name, `type: knowledge`, `tags: [evergreen]` for timeless content). Do not keep the same material duplicated in both folders — the research note documents the *process* (what was tried, sources, open questions); the knowledge note holds the *end state* (the answer / how-to). A conclusion that is only useful within a single investigation may stay in `20_research/`.

## Common Pitfalls

- Do not create untimestamped files in `10_tasks/`, `20_research/`, or `90_archive/` except `_template.md`.
- Do not treat `.mdgraph/*.db` as authoritative data.
- Do not rely on template notes as real knowledge; templates are ignored by MDGraph indexing.
- Do not overwrite notes just because a generated title collides; search first and choose update vs new note deliberately.

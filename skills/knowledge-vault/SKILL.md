---
name: knowledge-vault
description: >
  Local Markdown knowledge vault management — folder structure, naming rules, frontmatter conventions,
  MDGraph workflow, agent task records, and engineering workflow references.
  Use this skill whenever the user mentions KnowledgeVault, mdgraph, agent task records,
  research notes, vault organization, or note creation/update/archive.
  Boundary: for general note-taking skills use `obsidian-markdown` instead.
  Do NOT use this skill when the question is purely about Obsidian plugin functionality
  or Markdown formatting syntax.
---

# KnowledgeVault

Local Markdown knowledge vault for long-term memory. Markdown files are the durable source of truth; MDGraph's SQLite index is a rebuildable cache.

> [!summary] TL;DR
> - Vault root: `<vault-root>/` with 4 directories: `10_tasks/`, `20_research/`, `30_knowledge/`, `90_archive/`
> - Timestamp prefix (`yyyymmdd_hhmmss_`) for agent tasks/research/archive; semantic names for `30_knowledge/`
> - Every note needs a stable `id`, a non-empty `type`, and at least one `tag`
> - MDGraph indexes notes; `mdgraph_*` MCP tools for search/explore/create/update

## Quick Reference

```
<vault-root>/
├── 10_tasks/       # Agent task records, timestamped
├── 20_research/    # Investigation process — surveys, sources, open questions
├── 30_knowledge/   # Reusable end state — concepts, projects, people, tools, how-to
│   ├── concepts/
│   ├── projects/
│   ├── people/
│   └── tools/
└── 90_archive/     # Archived, timestamped
```

## Routing Table

| User intent | Load this reference |
|---|---|
| "Which folder / how to name a note" | `references/folder-rules.md` |
| "What frontmatter fields to use" | `references/frontmatter.md` |
| "How to write / what makes a good note" | `references/writing.md` |
| "MDGraph commands / MCP tools / create/update safety" | `references/mdgraph-workflow.md` |

## Boundary: vs other skills

| Use this skill when | Use other skill when |
|---|---|
| Vault folder structure, naming, and organization | `obsidian-markdown` for Obsidian-specific syntax |
| Creating/updating/searching vault notes via MDGraph | Direct codebase work that doesn't touch the vault |
| Folder/frontmatter rules for task records | `mdgraph-loop` for loop-driven engineering workflow state |

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
> - Vault root: `<vault-root>/` with 5 directories: `00_inbox/`, `10_tasks/`, `20_research/`, `30_knowledge/`, `90_archive/`
> - Timestamp prefix (`yyyymmdd_hhmmss_`) for inbox/agent tasks/research/archive; semantic names for `30_knowledge/`
> - Every note needs a stable `id`, a non-empty `type`, and at least one `tag`
> - MDGraph indexes notes; `mdgraph_*` MCP tools for search/create/update

## When to use

Use this skill when:

- Creating, updating, or organizing notes in the knowledge vault
- Recording an AI agent task or coding session
- Searching vault content or maintaining the MDGraph index
- Deciding which folder or frontmatter to use for a new note

Do **not** use this skill when:

- Writing general Markdown formatting or Obsidian plugin config → use `obsidian-markdown`
- The question is purely about tool usage without vault interaction

## Quick Reference

```
<vault-root>/
├── 00_inbox/       # Quick capture, timestamped
├── 10_tasks/       # Agent task records, timestamped
├── 20_research/    # Research notes, timestamped
├── 30_knowledge/   # Long-lived knowledge (concepts, projects, people, tools)
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

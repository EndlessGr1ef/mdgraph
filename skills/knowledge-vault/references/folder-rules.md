# Folder Rules

## Directory Map

```
00_inbox/       Quick captures, rough notes, temporary ideas
10_tasks/       AI agent task records, handoffs, session summaries
20_research/    Research notes, source summaries, investigations
30_knowledge/   Long-lived knowledge, concepts, projects, people, tools
90_archive/     Archived notes and completed material
```

Under `30_knowledge/`:

```
30_knowledge/concepts/
30_knowledge/projects/
30_knowledge/people/
30_knowledge/tools/
```

## Naming Rules

### Timestamp-prefixed folders

Use `yyyymmdd_hhmmss_name.md` or `yyyymmdd_hhmmss_name/` for:

- `00_inbox/`
- `10_tasks/`
- `20_research/`
- `90_archive/`

Examples:

```
00_inbox/20260603_190500_quick-capture.md
10_tasks/20260603_191200_mdgraph-read-note/
20_research/20260603_192000_local-first-knowledge-graph.md
90_archive/20260603_193000_old-agent-task.md
```

### Semantic names

Use stable kebab-case names for `30_knowledge/` (long-term linking):

```
30_knowledge/concepts/local-first.md
30_knowledge/projects/mdgraph.md
30_knowledge/people/example-person.md
30_knowledge/tools/sqlite.md
```

## Which Folder to Use

- **00_inbox/** — fast capture when the final home is unclear
- **10_tasks/** — AI agent task records, session handoffs, implementation logs, and decisions from coding sessions
- **20_research/** — investigations, source summaries, video/article analysis, notes that cite external material
- **30_knowledge/** — durable concepts, project context, people, tools, reusable long-lived knowledge; add `tags: [evergreen]` for timeless content
- **90_archive/** — completed or obsolete material that should remain searchable but not active; keep the original `type` and use `status: archived`

When unsure, capture in `00_inbox/` first rather than forcing a premature taxonomy.

## Template Files

Each major directory has a `_template.md`. MDGraph ignores `**/_template.md` by default. Current locations:

```
00_inbox/_template.md
10_tasks/_template.md
20_research/_template.md
30_knowledge/_template.md
30_knowledge/concepts/_template.md
30_knowledge/projects/_template.md
30_knowledge/people/_template.md
30_knowledge/tools/_template.md
90_archive/_template.md
```

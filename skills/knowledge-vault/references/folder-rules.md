# Folder Rules

## Directory Map

```
10_tasks/       AI agent task records, handoffs, session summaries
20_research/    Investigation process — surveys, sources, open questions
30_knowledge/   Reusable end state — concepts, projects, people, tools, how-to
90_archive/     Archived notes and completed material
```

Under `30_knowledge/`:

```
30_knowledge/concepts/
30_knowledge/projects/
30_knowledge/people/
30_knowledge/tools/
30_knowledge/daily/    # dated recurring analysis (e.g. daily a-stock reviews)
```

## Naming Rules

### Timestamp-prefixed folders

Use `yyyymmdd_hhmmss_name.md` or `yyyymmdd_hhmmss_name/` for:

- `10_tasks/`
- `20_research/`
- `90_archive/`

Examples:

```
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

**Deciding rule — process vs end state:** ask whether the note records a *process* (how you explored/investigated, what you tried, sources consulted) or *crystallizes a reusable end state* (what the answer/how-to is). Process → `20_research/`, end state → `30_knowledge/`. The rule is decisive; do not fall back on intuition.

- **10_tasks/** — AI agent task records, session handoffs, implementation logs, and decisions from coding sessions
- **20_research/** — the *process* of investigating: surveys, source summaries, video/article analysis, notes that cite external material, open questions, work-in-progress findings
- **30_knowledge/** — the *end state*: durable, reusable conclusions, concepts, project context, people, tools, and how-to knowledge; add `tags: [evergreen]` for timeless content
- **90_archive/** — completed or obsolete material that should remain searchable but not active; keep the original `type` and use `status: archived`

When a note mixes both, write the investigation under `20_research/` (timestamped, `type: research`) and, once the reusable conclusion is stable, crystallize it into `30_knowledge/`; do not duplicate the same material in both folders.

## Template Files

Each major directory has a `_template.md`. MDGraph ignores `**/_template.md` by default. Current locations:

```
10_tasks/_template.md
20_research/_template.md
30_knowledge/_template.md
30_knowledge/concepts/_template.md
30_knowledge/projects/_template.md
30_knowledge/people/_template.md
30_knowledge/tools/_template.md
90_archive/_template.md
```

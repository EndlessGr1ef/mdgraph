import type { Database as DatabaseHandle } from "better-sqlite3";
import { getNote, searchNotes, sha256 } from "./db.js";
import type { SearchResult } from "./types.js";

/**
 * Question-oriented vault exploration (`mdgraph_explore_notes`).
 *
 * Given a query, this returns the strongest few notes in full as "answer
 * notes" plus one-line pointers to weakly-related material — the idea being
 * that an agent asking a question wants a couple of solid bodies to read, not
 * fifty compact search summaries. Session-level dedup means a note already
 * served unchanged earlier IN THIS CONVERSATION comes back as a pointer
 * instead of being repeated.
 *
 * Thresholds (documented here so the behavior is honest and stable):
 *
 * - Answer count: top `maxNotes` (default 3, clamped to 2–5) results, in rank
 *   order. Depends only on `searchNotes` ordering, so we deliberately keep
 *   score-based falloff out and let the agent tune `maxNotes`.
 * - Pointers: the next `EXPLORE_LIMITS.MAX_POINTERS` results, one line each
 *   (id, title, path, tags). Their bodies are never sent here.
 * - Dedup: a note is replaced by a pointer only when (a) it was served in
 *   full this session, (b) its current `sha256(body)` hash matches what was
 *   served (an edit between calls therefore re-serves), and (c) its body is
 *   at least `EXPLORE_LIMITS.MIN_BODY_LINES` lines — a shorter body is cheaper
 *   to re-send than to point back at (CodeGraph's MIN_COVERED_LINES rationale).
 * - Low confidence: when the top result has no query token in its title,
 *   path, or snippet, the top match is weak — we append an honest footnote
 *   rather than pretending the answer is comprehensive.
 */

export const EXPLORE_LIMITS = {
  /** Shortest body that may be replaced by a dedup pointer. */
  MIN_BODY_LINES: 8,
  /** Capacity of the per-session served store; oldest served evicted first. */
  MAX_SERVED: 200,
  /** Weakly-related pointers rendered after the answer notes. */
  MAX_POINTERS: 10,
} as const;

const DEFAULT_MAX_NOTES = 3;
export const LOW_CONFIDENCE_NOTE = "Results may be incomplete — try a precise title, tag, or note id.";

/** What this session last served in full for one note id. */
export interface ServedNoteRecord {
  bodyHash: string;
  servedAt: number;
}

/**
 * Bounded, session-scoped record of notes served in full. Lives only in the
 * MCP server process memory and dies with it; nothing here is persisted and
 * nothing is written to the DB.
 */
export class ServedNotesStore {
  private readonly records = new Map<string, ServedNoteRecord>();

  get(id: string): ServedNoteRecord | undefined {
    return this.records.get(id);
  }

  set(id: string, bodyHash: string): void {
    // Re-insert to move to the most-recently-served tail; eviction drops the
    // oldest-served head when the bound is exceeded.
    this.records.delete(id);
    this.records.set(id, { bodyHash, servedAt: Date.now() });
    while (this.records.size > EXPLORE_LIMITS.MAX_SERVED) {
      const oldest = this.records.keys().next();
      if (oldest.done) break;
      this.records.delete(oldest.value);
    }
  }
}

export interface ExploreOptions {
  /** Answer-note count (clamped to 2–5). */
  maxNotes?: number;
  /** Per-session served-store; absent = no cross-call dedup. */
  served?: ServedNotesStore;
}

export interface ExploreAnswerNote {
  id: string;
  title: string;
  path: string;
  tags: string[];
  /** Rendered body: full content, or a dedup pointer line when re-served. */
  body: string;
  /** True when the body was replaced by a pointer because it was already served. */
  deduped: boolean;
}

export interface ExplorePointer {
  id: string;
  title: string;
  path: string;
  tags: string[];
}

export interface ExploreResult {
  query: string;
  answerNotes: ExploreAnswerNote[];
  relatedPointers: ExplorePointer[];
  lowConfidence: boolean;
  note?: string;
  /** Full markdown rendering (answer notes + pointers + optional footnote). */
  markdown: string;
}

/** The pointer line that replaces a body already served unchanged this session. */
function dedupPointer(id: string, title: string): string {
  return `[${id}] ${title} — already served earlier in this conversation, unchanged since. Not repeated.`;
}

/**
 * Honest weak-match check: the top result is a usable entry point only if one
 * of the query tokens actually shows up in its title, path, or snippet. Not
 * having any such token (or having no results at all) means the query mostly
 * matched on common words, so an expository "answer" would be misleading.
 */
export function isWeakMatch(
  query: string,
  results: Array<Pick<SearchResult, "title" | "path" | "snippet">>,
): boolean {
  if (results.length === 0) return true;
  const top = results[0];
  const haystack = `${top.title} ${top.path} ${top.snippet}`.toLowerCase();
  const tokens = query
    .normalize("NFKC")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return !tokens.some((token) => haystack.includes(token));
}

function isTinyBody(body: string): boolean {
  return body.trim().split("\n").filter((line) => line.trim() !== "").length < EXPLORE_LIMITS.MIN_BODY_LINES;
}

export function exploreNotes(db: DatabaseHandle, query: string, opts: ExploreOptions = {}): ExploreResult {
  const results = searchNotes(db, query, { limit: 50 });
  const maxNotes = Math.max(2, Math.min(opts.maxNotes ?? DEFAULT_MAX_NOTES, 5));

  const answerNotes: ExploreAnswerNote[] = [];
  for (const r of results.slice(0, maxNotes)) {
    const note = getNote(db, r.id);
    if (!note) continue;
    const hash = sha256(note.body);
    const served = opts.served?.get(r.id);
    const reuse = served !== undefined && served.bodyHash === hash && !isTinyBody(note.body);
    if (reuse) {
      answerNotes.push({
        id: note.id,
        title: note.title,
        path: note.path,
        tags: r.tags,
        body: dedupPointer(note.id, note.title),
        deduped: true,
      });
    } else {
      opts.served?.set(r.id, hash);
      answerNotes.push({
        id: note.id,
        title: note.title,
        path: note.path,
        tags: r.tags,
        body: note.body,
        deduped: false,
      });
    }
  }

  const relatedPointers: ExplorePointer[] = results
    .slice(maxNotes, maxNotes + EXPLORE_LIMITS.MAX_POINTERS)
    .map((r) => ({ id: r.id, title: r.title, path: r.path, tags: r.tags }));

  const lowConfidence = isWeakMatch(query, results);
  return {
    query,
    answerNotes,
    relatedPointers,
    lowConfidence,
    note: lowConfidence ? LOW_CONFIDENCE_NOTE : undefined,
    markdown: renderMarkdown(answerNotes, relatedPointers, lowConfidence),
  };
}

function renderMarkdown(
  answerNotes: ExploreAnswerNote[],
  pointers: ExplorePointer[],
  lowConfidence: boolean,
): string {
  const lines: string[] = ["## Answer notes"];
  for (const a of answerNotes) {
    lines.push("", `### ${a.title} (\`${a.path}\`)`);
    lines.push(a.deduped ? `> ${a.body}` : a.body);
  }
  if (pointers.length > 0) {
    lines.push("", "## Related (pointers)");
    for (const p of pointers) {
      const tags = p.tags.length ? ` #${p.tags.join(" #")}` : "";
      lines.push(`- [${p.id}] ${p.title} — \`${p.path}\`${tags}`);
    }
  }
  if (lowConfidence) {
    lines.push("", "## Note", LOW_CONFIDENCE_NOTE);
  }
  return lines.join("\n");
}

import type { Database as DatabaseHandle } from "better-sqlite3";
import { getNote, searchNotes, sha256 } from "./db.js";
import type { MarkdownHeading, SearchResult } from "./types.js";

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
 * - Output budget: answer bodies share `MAX_TOTAL_CHARS - 800` characters, each
 *   note is capped at `MAX_NOTE_CHARS`, and a starved note becomes a pointer.
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
  /** Hard cap on answer-note body characters in one response. */
  MAX_TOTAL_CHARS: 12000,
  /** Hard cap on a single answer note's body characters. */
  MAX_NOTE_CHARS: 6000,
} as const;

const DEFAULT_MAX_NOTES = 3;
export const LOW_CONFIDENCE_NOTE = "Results may be incomplete — try a precise title, tag, or note id.";

/** Characters held back for the pointer section and the response scaffolding. */
const POINTER_RESERVE_CHARS = 800;
/** Bounds the omitted-section list so metadata cannot grow back. */
const MAX_OMITTED_SECTIONS = 8;
/** A heading cut must keep at least this share of the cap to be worth using. */
const HEADING_CUT_MIN_SHARE = 0.6;
/** Headroom for the stale flag and warning the MCP layer appends. */
const STALE_ANNOTATION_RESERVE_CHARS = 240;
/** Fit loop floor: an answer body is never shortened below this. */
const MIN_ANSWER_CHARS = 1000;
/** Extra shrink room for metadata that grows when sections are omitted. */
const SHRINK_MARGIN_CHARS = 128;
/** Opening or closing line of a ``` or ~~~ fenced code block. */
const FENCE_MARKER_RE = /^\s*(```|~~~)/;

/** What this session last served in full for one note id. */
export interface ServedNoteRecord {
  bodyHash: string;
  /** Delivered body characters; a truncated serve is not reusable. */
  servedChars: number;
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

  set(id: string, bodyHash: string, servedChars: number): void {
    // Re-insert to move to the most-recently-served tail; eviction drops the
    // oldest-served head when the bound is exceeded.
    this.records.delete(id);
    this.records.set(id, { bodyHash, servedChars, servedAt: Date.now() });
    while (this.records.size > EXPLORE_LIMITS.MAX_SERVED) {
      const oldest = this.records.keys().next();
      if (oldest.done) break;
      this.records.delete(oldest.value);
    }
  }

  /** Forget one record so a fresh re-run can re-send that body. */
  delete(id: string): void {
    this.records.delete(id);
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
  /** Rendered body: full content, a budget slice, or a dedup pointer line. */
  body: string;
  /** True when the body was replaced by a pointer because it was already served. */
  deduped: boolean;
  /** True when the body was cut to fit the output budget. */
  truncated: boolean;
  /** Titles of the sections dropped by the cut (bounded). */
  omittedSections: string[];
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

export interface SlicedBody {
  body: string;
  truncated: boolean;
  omittedSections: string[];
}

/** Start offset of every body line; line N (1-based) starts at starts[N - 1]. */
function lineStartOffsets(body: string): number[] {
  const starts = [0];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

/** Fence marker (``` or ~~~) still open at the end of `text`, if any. */
function openFenceMarker(text: string): string | undefined {
  let open: string | undefined;
  for (const line of text.split("\n")) {
    const match = FENCE_MARKER_RE.exec(line);
    if (!match) continue;
    open = open ? undefined : match[1];
  }
  return open;
}

/**
 * Cut a body to `cap` characters, preferring a heading or newline boundary that
 * keeps at least 60% of the cap. A fence left open is closed inside the cap.
 */
export function sliceBody(body: string, headings: MarkdownHeading[], cap: number, minCut = 0): SlicedBody {
  if (body.length <= cap) return { body, truncated: false, omittedSections: [] };

  const starts = lineStartOffsets(body);
  const inRange = headings.filter((heading) => heading.line >= 1 && heading.line <= starts.length);
  const boundaries = inRange
    .map((heading) => starts[heading.line - 1])
    .filter((offset) => offset > 0 && offset <= cap);
  const boundary = boundaries.length > 0 ? Math.max(...boundaries) : -1;
  const newlineCut = body.lastIndexOf("\n", cap - 1) + 1;
  let cut = cap;
  if (boundary >= cap * HEADING_CUT_MIN_SHARE) cut = boundary;
  else if (newlineCut >= cap * HEADING_CUT_MIN_SHARE) cut = newlineCut;
  if (cut < minCut) cut = Math.min(cap, minCut);

  let kept = body.slice(0, cut);
  let omittedFrom = cut;
  const open = openFenceMarker(kept);
  if (open) {
    // Never retreat to the opener: fill the cap and close the fence inside it.
    omittedFrom = Math.max(0, cap - open.length - 1);
    const head = body.slice(0, omittedFrom);
    kept = openFenceMarker(head) ? `${head}${head.endsWith("\n") || head.length === 0 ? "" : "\n"}${open}` : head;
  }

  return {
    body: kept,
    truncated: true,
    omittedSections: inRange
      .filter((heading) => starts[heading.line - 1] >= omittedFrom)
      .slice(0, MAX_OMITTED_SECTIONS)
      .map((heading) => heading.text),
  };
}

export function exploreNotes(db: DatabaseHandle, query: string, opts: ExploreOptions = {}): ExploreResult {
  const results = searchNotes(db, query, { limit: 50 });
  const maxNotes = Math.max(2, Math.min(opts.maxNotes ?? DEFAULT_MAX_NOTES, 5));

  const answerNotes: ExploreAnswerNote[] = [];
  const budgetPointers: ExplorePointer[] = [];
  const fullBodies = new Map<string, { body: string; headings: MarkdownHeading[] }>();
  let remaining = EXPLORE_LIMITS.MAX_TOTAL_CHARS - POINTER_RESERVE_CHARS;
  let bodyServed = false;

  for (const r of results.slice(0, maxNotes)) {
    const note = getNote(db, r.id);
    if (!note) continue;
    const hash = sha256(note.body);
    const served = opts.served?.get(r.id);
    const reuse =
      served !== undefined &&
      served.bodyHash === hash &&
      served.servedChars >= note.body.length &&
      !isTinyBody(note.body);
    if (reuse) {
      answerNotes.push({
        id: note.id,
        title: note.title,
        path: note.path,
        tags: r.tags,
        body: dedupPointer(note.id, note.title),
        deduped: true,
        truncated: false,
        omittedSections: [],
      });
      continue;
    }

    // Dedup pointers are free; a starved note becomes a pointer, never a fragment.
    if (bodyServed && remaining < MIN_ANSWER_CHARS) {
      budgetPointers.push({ id: note.id, title: note.title, path: note.path, tags: r.tags });
      continue;
    }
    const allowance = Math.min(note.body.length, EXPLORE_LIMITS.MAX_NOTE_CHARS, remaining);
    const sliced = sliceBody(note.body, note.outline, allowance, MIN_ANSWER_CHARS);
    remaining -= sliced.body.length;
    bodyServed = true;
    fullBodies.set(note.id, { body: note.body, headings: note.outline });
    answerNotes.push({
      id: note.id,
      title: note.title,
      path: note.path,
      tags: r.tags,
      body: sliced.body,
      deduped: false,
      truncated: sliced.truncated,
      omittedSections: sliced.omittedSections,
    });
  }

  const relatedPointers: ExplorePointer[] = [
    ...budgetPointers,
    ...results.slice(maxNotes, maxNotes + EXPLORE_LIMITS.MAX_POINTERS).map((r) => ({
      id: r.id,
      title: r.title,
      path: r.path,
      tags: r.tags,
    })),
  ];

  const lowConfidence = isWeakMatch(query, results);
  const result = fitPayloadToBudget(
    {
      query,
      answerNotes,
      relatedPointers,
      lowConfidence,
      note: lowConfidence ? LOW_CONFIDENCE_NOTE : undefined,
    },
    fullBodies,
    budgetPointers.length,
  );

  // Record only delivered bodies with their final length, so dedup never hides a cut.
  if (opts.served) {
    for (const answer of result.answerNotes) {
      if (answer.deduped) continue;
      const full = fullBodies.get(answer.id);
      if (full) opts.served.set(answer.id, sha256(full.body), answer.body.length);
    }
  }
  return result;
}

/**
 * Fit the pretty-printed payload: shrink bodies to the floor, drop subordinate
 * answers, shorten the top answer last, and only then drop pointers.
 */
function fitPayloadToBudget(
  result: ExploreResult,
  fullBodies: Map<string, { body: string; headings: MarkdownHeading[] }>,
  budgetPointerCount: number,
): ExploreResult {
  const limit = EXPLORE_LIMITS.MAX_TOTAL_CHARS - STALE_ANNOTATION_RESERVE_CHARS;
  const size = () => JSON.stringify(result, null, 2).length;

  // 1. Shrink the lower-ranked answers first; the top note is handled last.
  for (let index = result.answerNotes.length - 1; index > 0 && size() > limit; index -= 1) {
    while (size() > limit && shrinkAnswer(result.answerNotes[index], fullBodies, size, limit)) {
      // Keep shrinking this answer until it fits or reaches the floor.
    }
  }

  // 2. A note that cannot shrink to the floor becomes a pointer instead.
  for (let index = result.answerNotes.length - 1; index > 0 && size() > limit; index -= 1) {
    const answer = result.answerNotes[index];
    if (answer.body.length < MIN_ANSWER_CHARS) continue;
    result.answerNotes.splice(index, 1);
    result.relatedPointers.unshift({ id: answer.id, title: answer.title, path: answer.path, tags: answer.tags });
    budgetPointerCount += 1;
  }

  // 3. Shortening the top answer is the last resort before losing pointers.
  const top = result.answerNotes[0];
  while (top && size() > limit) {
    if (!shrinkAnswer(top, fullBodies, size, limit)) break;
  }

  // 4. Search pointers go from the tail, then budget pointers only as a last resort.
  while (size() > limit && result.relatedPointers.length > budgetPointerCount) {
    result.relatedPointers.pop();
  }
  while (size() > limit && result.relatedPointers.length > 0) {
    result.relatedPointers.pop();
  }
  return result;
}

/** Shrink one answer body to fit `limit`; returns false when the floor is hit. */
function shrinkAnswer(
  answer: ExploreAnswerNote,
  fullBodies: Map<string, { body: string; headings: MarkdownHeading[] }>,
  size: () => number,
  limit: number,
): boolean {
  const full = fullBodies.get(answer.id);
  if (!full || answer.body.length <= MIN_ANSWER_CHARS) return false;
  const overBy = size() - limit;
  const cap = Math.max(MIN_ANSWER_CHARS, answer.body.length - overBy - SHRINK_MARGIN_CHARS);
  if (cap >= answer.body.length) return false;
  const sliced = sliceBody(full.body, full.headings, cap, MIN_ANSWER_CHARS);
  if (sliced.body.length >= answer.body.length || sliced.body.length < MIN_ANSWER_CHARS) return false;
  answer.body = sliced.body;
  answer.truncated = sliced.truncated;
  answer.omittedSections = sliced.omittedSections;
  return true;
}

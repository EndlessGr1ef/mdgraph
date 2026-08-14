import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { resolveDbPath, resolveStoreDir } from "./paths.js";
import type {
  AmbiguousLink,
  GraphEdge,
  GraphNode,
  GraphOptions,
  GraphResult,
  GraphSummary,
  MarkdownHeading,
  NoteGraph,
  ParsedNote,
  ResolveCandidate,
  ResolvedLinkTarget,
  SearchOptions,
  SearchResult,
} from "./types.js";

export const CURRENT_SCHEMA_VERSION = 3;

export interface MdGraphDb {
  db: DatabaseHandle;
  close: () => void;
}

interface NoteRow {
  id: string;
  path: string;
  title: string;
  type: string;
  status: string;
  created: string | null;
  updated: string | null;
  frontmatter_json: string;
  body: string;
  headings_json: string;
  indexed_at: string;
}

export function openDb(vaultRoot: string): MdGraphDb {
  fs.mkdirSync(resolveStoreDir(vaultRoot), { recursive: true });
  const dbPath = resolveDbPath(vaultRoot);
  let db = openDatabase(dbPath);
  if (shouldRebuildDatabase(db)) {
    db.close();
    removeDatabaseFiles(dbPath);
    db = openDatabase(dbPath);
  }
  migrate(db);
  return { db, close: () => db.close() };
}

function openDatabase(dbPath: string): DatabaseHandle {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function shouldRebuildDatabase(db: DatabaseHandle): boolean {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version === CURRENT_SCHEMA_VERSION || version === 0) {
    return hasApplicationSchema(db) && !hasCurrentSchema(db);
  }
  return true;
}

function hasApplicationSchema(db: DatabaseHandle): boolean {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('files', 'notes', 'tags', 'aliases', 'links', 'notes_fts')
    LIMIT 1
  `).get();
  return row !== undefined;
}

function hasCurrentSchema(db: DatabaseHandle): boolean {
  const requiredColumns: Record<string, string[]> = {
    files: ["id", "path", "hash", "mtime_ms", "size", "deleted", "indexed_at"],
    notes: [
      "id",
      "file_id",
      "path",
      "title",
      "type",
      "status",
      "created",
      "updated",
      "frontmatter_json",
      "body",
      "headings_json",
      "body_hash",
      "indexed_at",
    ],
    tags: ["note_id", "tag"],
    aliases: ["note_id", "alias"],
    links: ["source_note_id", "target"],
  };

  for (const [table, columns] of Object.entries(requiredColumns)) {
    const existing = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
    );
    if (columns.some((column) => !existing.has(column))) return false;
  }

  const fts = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'notes_fts'
    LIMIT 1
  `).get() as { sql: string } | undefined;
  // The FTS table must exist AND use the trigram tokenizer; an older or
  // hand-created unicode61 table silently breaks short CJK queries.
  return fts !== undefined && fts.sql.toLowerCase().includes("trigram");
}

function removeDatabaseFiles(dbPath: string): void {
  for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    fs.rmSync(filePath, { force: true });
  }
}

function migrate(db: DatabaseHandle): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      size INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created TEXT,
      updated TEXT,
      frontmatter_json TEXT NOT NULL,
      body TEXT NOT NULL,
      headings_json TEXT NOT NULL DEFAULT '[]',
      body_hash TEXT NOT NULL,
      indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (note_id, tag)
    );

    CREATE TABLE IF NOT EXISTS aliases (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      PRIMARY KEY (note_id, alias)
    );

    CREATE TABLE IF NOT EXISTS links (
      source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      PRIMARY KEY (source_note_id, target)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      title,
      path,
      body,
      tags,
      aliases,
      tokenize = 'trigram'
    );

    CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
    CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
    CREATE INDEX IF NOT EXISTS idx_links_target ON links(target);

    PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};
  `);
}

export function sha256(text: string | Buffer): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function upsertNote(db: DatabaseHandle, note: ParsedNote, fileStat: fs.Stats, raw: string): void {
  const fileHash = sha256(raw);
  const bodyHash = sha256(note.body);

  const tx = db.transaction(() => {
    const duplicate = db.prepare(`
      SELECT path FROM notes WHERE id = ? AND path != ? AND status != 'deleted'
    `).get(note.id, note.path) as { path: string } | undefined;
    if (duplicate) {
      throw new Error(`Duplicate note id "${note.id}" in ${note.path}; already used by ${duplicate.path}`);
    }

    const existingAtPath = db.prepare("SELECT id FROM notes WHERE path = ?").get(note.path) as { id: string } | undefined;
    if (existingAtPath && existingAtPath.id !== note.id) {
      db.prepare("DELETE FROM notes_fts WHERE note_id = ?").run(existingAtPath.id);
      db.prepare("DELETE FROM notes WHERE id = ?").run(existingAtPath.id);
    }

    db.prepare(`
      INSERT INTO files (path, hash, mtime_ms, size, deleted, indexed_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET
        hash = excluded.hash,
        mtime_ms = excluded.mtime_ms,
        size = excluded.size,
        deleted = 0,
        indexed_at = CURRENT_TIMESTAMP
    `).run(note.path, fileHash, Math.trunc(fileStat.mtimeMs), fileStat.size);

    const file = db.prepare("SELECT id FROM files WHERE path = ?").get(note.path) as { id: number };

    db.prepare(`
      INSERT INTO notes (
        id, file_id, path, title, type, status, created, updated,
        frontmatter_json, body, headings_json, body_hash, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        file_id = excluded.file_id,
        path = excluded.path,
        title = excluded.title,
        type = excluded.type,
        status = excluded.status,
        created = excluded.created,
        updated = excluded.updated,
        frontmatter_json = excluded.frontmatter_json,
        body = excluded.body,
        headings_json = excluded.headings_json,
        body_hash = excluded.body_hash,
        indexed_at = CURRENT_TIMESTAMP
    `).run(
      note.id,
      file.id,
      note.path,
      note.title,
      note.type,
      note.status,
      note.created,
      note.updated,
      JSON.stringify(note.frontmatter),
      note.body,
      JSON.stringify(note.headings),
      bodyHash,
    );

    db.prepare("DELETE FROM tags WHERE note_id = ?").run(note.id);
    db.prepare("DELETE FROM aliases WHERE note_id = ?").run(note.id);
    db.prepare("DELETE FROM links WHERE source_note_id = ?").run(note.id);
    db.prepare("DELETE FROM notes_fts WHERE note_id = ?").run(note.id);

    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (note_id, tag) VALUES (?, ?)");
    const insertAlias = db.prepare("INSERT OR IGNORE INTO aliases (note_id, alias) VALUES (?, ?)");
    const insertLink = db.prepare("INSERT OR IGNORE INTO links (source_note_id, target) VALUES (?, ?)");

    for (const tag of note.tags) insertTag.run(note.id, tag);
    for (const alias of note.aliases) insertAlias.run(note.id, alias);
    for (const link of note.links) insertLink.run(note.id, link);

    db.prepare(`
      INSERT INTO notes_fts (note_id, title, path, body, tags, aliases)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(note.id, note.title, note.path, note.body, note.tags.join(" "), note.aliases.join(" "));
  });

  tx();
}

export function markDeleted(db: DatabaseHandle, relativePath: string): void {
  const tx = db.transaction(() => {
    const note = db.prepare("SELECT id FROM notes WHERE path = ?").get(relativePath) as { id: string } | undefined;
    if (note) {
      db.prepare("UPDATE notes SET status = 'deleted', indexed_at = CURRENT_TIMESTAMP WHERE id = ?").run(note.id);
      db.prepare("DELETE FROM tags WHERE note_id = ?").run(note.id);
      db.prepare("DELETE FROM aliases WHERE note_id = ?").run(note.id);
      db.prepare("DELETE FROM links WHERE source_note_id = ?").run(note.id);
      db.prepare("DELETE FROM notes_fts WHERE note_id = ?").run(note.id);
    }
    db.prepare("UPDATE files SET deleted = 1, indexed_at = CURRENT_TIMESTAMP WHERE path = ?").run(relativePath);
  });
  tx();
}

function escapeFtsQuery(query: string): string {
  return `"${query.replaceAll('"', '""')}"`;
}

const CJK_RUN_RE = /\p{Script=Han}+/gu;

function hasShortCjkRun(query: string): boolean {
  for (const match of query.matchAll(CJK_RUN_RE)) {
    if ([...match[0]].length < 3) return true;
  }
  return false;
}

function normalizeQuery(query: string): string {
  return query.normalize("NFKC").trim();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function makeSnippet(body: string, tokens: string[]): string {
  const lowered = body.toLowerCase();
  const first = tokens.find((token) => lowered.includes(token.toLowerCase()));
  if (!first) return body.slice(0, 80);
  const index = lowered.indexOf(first.toLowerCase());
  const start = Math.max(0, index - 20);
  const end = Math.min(body.length, index + first.length + 40);
  return `${start > 0 ? "… " : ""}${body.slice(start, index)}[${body.slice(index, index + first.length)}]${body.slice(index + first.length, end)}${end < body.length ? " …" : ""}`;
}

function safeParseHeadings(value: string): MarkdownHeading[] {
  try {
    const parsed = JSON.parse(value) as MarkdownHeading[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface SearchRow {
  id: string;
  path: string;
  title: string;
  type: string;
  status: string;
  headings_json: string;
  tags: string;
  snippet: string;
  rank: number;
}

export function searchNotes(db: DatabaseHandle, query: string, options: SearchOptions = {}): SearchResult[] {
  const normalized = normalizeQuery(query);
  const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit as number) : 10;
  const limit = Math.max(1, Math.min(requestedLimit, 50));

  // Shared filters over the notes table (used by both query paths)
  const filters: string[] = [];
  const params: unknown[] = [];
  if (options.status) {
    filters.push("n.status = ?");
    params.push(options.status);
  } else {
    filters.push("n.status != 'deleted'");
  }
  if (options.type) {
    filters.push("n.type = ?");
    params.push(options.type);
  }
  if (options.tag) {
    filters.push("EXISTS (SELECT 1 FROM tags t WHERE t.note_id = n.id AND t.tag = ?)");
    params.push(options.tag);
  }
  const baseFilters = filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

  const toResults = (rows: SearchRow[]) =>
    rows.map(({ headings_json, ...row }) => ({
      ...row,
      tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
      outline: safeParseHeadings(headings_json),
      graph: getGraphSummary(db, row.id),
    }));

  // The trigram tokenizer indexes CJK runs as single tokens, so 1-2 char
  // queries can never match. Route those queries through LIKE substring
  // search instead, with title matches ranked above path and body matches.
  if (hasShortCjkRun(normalized)) {
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const tokenConditions = tokens
      .map(() => `(n.title LIKE ? ESCAPE '\\' OR n.path LIKE ? ESCAPE '\\' OR n.body LIKE ? ESCAPE '\\')`)
      .join(" AND ");
    const likeParams = tokens.flatMap((token) => Array<string>(3).fill(`%${escapeLike(token)}%`));
    const firstLike = `%${escapeLike(tokens[0])}%`;

    const rows = db.prepare(`
      SELECT
        n.id,
        n.path,
        n.title,
        n.type,
        n.status,
        n.headings_json,
        n.body,
        COALESCE((SELECT group_concat(t.tag, ',') FROM tags t WHERE t.note_id = n.id), '') AS tags
      FROM notes n
      WHERE ${tokenConditions}${baseFilters}
      ORDER BY (n.title LIKE ? ESCAPE '\\') DESC, (n.path LIKE ? ESCAPE '\\') DESC, length(n.body), n.title
      LIMIT ?
    `).all(...likeParams, ...params, firstLike, firstLike, limit) as Array<SearchRow & { body: string }>;

    return toResults(
      rows.map(({ body, ...row }) => ({ ...row, rank: 0, snippet: makeSnippet(body, tokens) })),
    );
  }

  const sql = `
    SELECT
      n.id,
      n.path,
      n.title,
      n.type,
      n.status,
      n.headings_json,
      COALESCE((SELECT group_concat(t.tag, ',') FROM tags t WHERE t.note_id = n.id), '') AS tags,
      snippet(notes_fts, 3, '[', ']', ' … ', 24) AS snippet,
      bm25(notes_fts, 10.0, 8.0, 1.0, 4.0, 6.0) AS rank
    FROM notes_fts
    JOIN notes n ON n.id = notes_fts.note_id
    WHERE notes_fts MATCH ?${baseFilters}
    ORDER BY rank
    LIMIT ?
  `;

  const run = (ftsQuery: string) => db.prepare(sql).all(ftsQuery, ...params, limit) as SearchRow[];

  let rows;
  try {
    rows = run(normalized);
  } catch {
    rows = run(escapeFtsQuery(normalized));
  }

  return toResults(rows);
}

export function getNote(db: DatabaseHandle, id: string, options?: { graphLimit?: number }) {
  const row = db.prepare(`
    SELECT id, path, title, type, status, created, updated, frontmatter_json, body, headings_json, indexed_at
    FROM notes
    WHERE id = ?
  `).get(id) as NoteRow | undefined;
  if (!row) return undefined;

  const { frontmatter_json, headings_json, ...note } = row;
  return {
    ...note,
    frontmatter: JSON.parse(frontmatter_json) as Record<string, unknown>,
    outline: safeParseHeadings(headings_json),
    graph: getGraphContext(db, id, { limit: options?.graphLimit }),
  };
}

// ---------------------------------------------------------------------------
// Graph query helpers
// ---------------------------------------------------------------------------

export function resolveLinkTarget(
  db: DatabaseHandle,
  rawTarget: string,
  sourcePath?: string,
): { status: "resolved"; id: string; path: string; title: string } | { status: "ambiguous"; candidates: ResolveCandidate[] } | { status: "broken" } {
  // Normalize relative file paths against the source note directory
  // DB paths are always POSIX (vault-relative with /), so use path.posix
  if (sourcePath && (rawTarget.startsWith("./") || rawTarget.startsWith("../") || rawTarget.endsWith(".md"))) {
    const dir = path.posix.dirname(sourcePath);
    rawTarget = path.posix.normalize(path.posix.join(dir, rawTarget));
  }

  // 1. Exact id match
  const byId = db.prepare("SELECT id, path, title FROM notes WHERE id = ? AND status != 'deleted'").all(rawTarget) as ResolveCandidate[];
  if (byId.length === 1) return { status: "resolved", ...byId[0] };
  if (byId.length > 1) return { status: "ambiguous", candidates: byId };

  // 2. Exact path match
  const byPath = db.prepare("SELECT id, path, title FROM notes WHERE path = ? AND status != 'deleted'").all(rawTarget) as ResolveCandidate[];
  if (byPath.length === 1) return { status: "resolved", ...byPath[0] };
  if (byPath.length > 1) return { status: "ambiguous", candidates: byPath };

  // 3. Stem/basename match (target + ".md" vs path or path's last component)
  const withExt = rawTarget + ".md";
  const byStem = db.prepare(
    "SELECT id, path, title FROM notes WHERE status != 'deleted' AND (path = ? OR path LIKE ?)",
  ).all(withExt, "%/" + withExt) as ResolveCandidate[];
  if (byStem.length === 1) return { status: "resolved", ...byStem[0] };
  if (byStem.length > 1) return { status: "ambiguous", candidates: byStem };

  // 4. Title match
  const byTitle = db.prepare("SELECT id, path, title FROM notes WHERE title = ? AND status != 'deleted'").all(rawTarget) as ResolveCandidate[];
  if (byTitle.length === 1) return { status: "resolved", ...byTitle[0] };
  if (byTitle.length > 1) return { status: "ambiguous", candidates: byTitle };

  // 5. Alias match
  const byAlias = db.prepare(`
    SELECT n.id, n.path, n.title FROM notes n
    JOIN aliases a ON a.note_id = n.id
    WHERE a.alias = ? AND n.status != 'deleted'
  `).all(rawTarget) as ResolveCandidate[];
  if (byAlias.length === 1) return { status: "resolved", ...byAlias[0] };
  if (byAlias.length > 1) return { status: "ambiguous", candidates: byAlias };

  return { status: "broken" };
}

/**
 * Unified backlink resolution: scans ALL active links, resolves each via
 * resolveLinkTarget, and collects backlinks (resolved.id === noteId) along
 * with ambiguous links that mention this note as a candidate.
 *
 * This replaces the error-prone identifier pre-filter approach which could
 * miss relative Markdown links (e.g. ./b.md, ../b.md, b.md) whose raw target
 * doesn't match any note identifier.
 */
function resolveBacklinks(
  db: DatabaseHandle,
  noteId: string,
  options?: { limit?: number },
): { backlinks: ResolvedLinkTarget[]; totalBacklinks: number; totalAmbiguous: number; ambiguousLinks: AmbiguousLink[] } {
  const limit = options?.limit ?? 25;

  const linkRows = db.prepare(`
    SELECT DISTINCT l.source_note_id, l.target, n.path AS source_path
    FROM links l
    JOIN notes n ON n.id = l.source_note_id
    WHERE n.status != 'deleted'
      AND l.source_note_id != ?
    ORDER BY n.path
  `).all(noteId) as {
    source_note_id: string;
    target: string;
    source_path: string;
  }[];

  const backlinks: ResolvedLinkTarget[] = [];
  const ambiguousLinks: AmbiguousLink[] = [];
  let totalBacklinks = 0;
  let totalAmbiguous = 0;
  const seen = new Set<string>();

  for (const row of linkRows) {
    if (seen.has(row.source_note_id)) continue;

    const resolved = resolveLinkTarget(db, row.target, row.source_path);
    if (resolved.status === "resolved" && resolved.id === noteId) {
      totalBacklinks++;
      seen.add(row.source_note_id);
      if (backlinks.length < limit) {
        backlinks.push({
          rawTarget: row.target,
          resolvedId: row.source_note_id,
          resolvedPath: row.source_path,
          resolvedTitle: "",
        });
      }
    } else if (resolved.status === "ambiguous" && resolved.candidates.some((c) => c.id === noteId)) {
      totalAmbiguous++;
      if (ambiguousLinks.length < limit) {
        ambiguousLinks.push({ rawTarget: row.target, candidates: resolved.candidates });
      }
    }
    // broken → not a backlink, ignored
  }

  // Fill titles for backlink source notes
  if (backlinks.length > 0) {
    const ids = backlinks.map((r) => r.resolvedId!);
    const ph = ids.map(() => "?").join(",");
    const titleRows = db.prepare(`SELECT id, title FROM notes WHERE id IN (${ph})`).all(...ids) as {
      id: string;
      title: string;
    }[];
    const titleMap = new Map(titleRows.map((r) => [r.id, r.title]));
    for (const r of backlinks) {
      r.resolvedTitle = titleMap.get(r.resolvedId!) ?? r.resolvedTitle;
    }
  }

  return { backlinks, totalBacklinks, totalAmbiguous, ambiguousLinks };
}

export function getBacklinks(
  db: DatabaseHandle,
  noteId: string,
  options?: { limit?: number },
): ResolvedLinkTarget[] {
  return resolveBacklinks(db, noteId, options).backlinks;
}

export function getGraphContext(
  db: DatabaseHandle,
  id: string,
  options?: { limit?: number },
): NoteGraph | undefined {
  const note = db.prepare("SELECT id, path FROM notes WHERE id = ?").get(id) as
    | { id: string; path: string }
    | undefined;
  if (!note) return undefined;

  const limit = options?.limit ?? 20;

  // -----------------------------------------------------------------------
  // Resolve outlinks (source = current note)
  // -----------------------------------------------------------------------
  const linkRows = db.prepare("SELECT target FROM links WHERE source_note_id = ?").all(id) as { target: string }[];

  const outlinks: ResolvedLinkTarget[] = [];
  const brokenLinks: string[] = [];
  const ambiguousLinks: AmbiguousLink[] = [];
  let totalOutlinks = 0;
  let totalBroken = 0;
  let totalAmbiguous = 0;

  for (const { target } of linkRows) {
    const result = resolveLinkTarget(db, target, note.path);
    if (result.status === "resolved") {
      totalOutlinks++;
      if (outlinks.length < limit) {
        outlinks.push({
          rawTarget: target,
          resolvedId: result.id,
          resolvedPath: result.path,
          resolvedTitle: result.title,
        });
      }
    } else if (result.status === "ambiguous") {
      totalAmbiguous++;
      if (ambiguousLinks.length < limit) {
        ambiguousLinks.push({ rawTarget: target, candidates: result.candidates });
      }
    } else {
      totalBroken++;
      if (brokenLinks.length < limit) {
        brokenLinks.push(target);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Resolve backlinks (other notes that link to this note)
  // -----------------------------------------------------------------------
  const blResult = resolveBacklinks(db, id, { limit });

  totalAmbiguous += blResult.totalAmbiguous;
  for (const al of blResult.ambiguousLinks) {
    if (ambiguousLinks.length < limit) {
      ambiguousLinks.push(al);
    }
  }

  return {
    outlinks,
    backlinks: blResult.backlinks,
    brokenLinks,
    ambiguousLinks,
    totalOutlinks,
    totalBacklinks: blResult.totalBacklinks,
    totalBroken,
    totalAmbiguous,
  };
}

export function getGraphSummary(
  db: DatabaseHandle,
  id: string,
  options?: { backlinkLimit?: number },
): GraphSummary | undefined {
  const note = db.prepare("SELECT id, path FROM notes WHERE id = ? AND status != 'deleted'").get(id) as
    | { id: string; path: string }
    | undefined;
  if (!note) return undefined;

  const linkRows = db.prepare("SELECT target FROM links WHERE source_note_id = ?").all(id) as { target: string }[];

  let outlinksCount = 0;
  let brokenCount = 0;
  const outlinksPreview: { id: string; title: string }[] = [];

  for (const { target } of linkRows) {
    outlinksCount++;
    const result = resolveLinkTarget(db, target, note.path);
    if (result.status === "resolved" && outlinksPreview.length < 3) {
      outlinksPreview.push({ id: result.id, title: result.title });
    } else if (result.status === "broken") {
      brokenCount++;
    }
    // ambiguous links count as outlinks but don't appear in preview
  }

  const blResult = resolveBacklinks(db, id, { limit: options?.backlinkLimit ?? 25 });
  const backlinksPreview = blResult.backlinks.slice(0, 3).map((bl) => ({
    id: bl.resolvedId!,
    title: bl.resolvedTitle!,
  }));

  return {
    outlinks: outlinksCount,
    backlinks: blResult.totalBacklinks,
    broken: brokenCount,
    outlinks_preview: outlinksPreview,
    backlinks_preview: backlinksPreview,
  };
}

export function getGraph(
  db: DatabaseHandle,
  id: string,
  options: GraphOptions = {},
): GraphResult | undefined {
  const root = db.prepare("SELECT id, path, title FROM notes WHERE id = ? AND status != 'deleted'").get(id) as
    | GraphNode
    | undefined;
  if (!root) return undefined;

  const depth = options.depth ?? 1;
  const direction = options.direction ?? "both";
  const maxNodes = options.maxNodes ?? 100;

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  nodes.set(root.id, root);
  const visited = new Set<string>([root.id]);

  const queue: Array<{ id: string; currentDepth: number }> = [{ id: root.id, currentDepth: 0 }];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    if (current.currentDepth >= depth) continue;

    // Follow outlinks (source → target)
    if (direction === "out" || direction === "both") {
      const currentPath = nodes.get(current.id)?.path;
      const linkRows = db.prepare("SELECT target FROM links WHERE source_note_id = ?").all(current.id) as {
        target: string;
      }[];

      for (const { target } of linkRows) {
        if (nodes.size >= maxNodes) break;
        const result = resolveLinkTarget(db, target, currentPath);
        if (result.status !== "resolved") continue;

        const edgeKey = `${current.id}::${result.id}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ source: current.id, target: result.id });
        }

        if (!visited.has(result.id)) {
          visited.add(result.id);
          nodes.set(result.id, { id: result.id, path: result.path, title: result.title });
          queue.push({ id: result.id, currentDepth: current.currentDepth + 1 });
        }
      }
    }

    // Follow backlinks (source → current)
    if (direction === "back" || direction === "both") {
      const backlinkNotes = getBacklinks(db, current.id);
      for (const bl of backlinkNotes) {
        if (nodes.size >= maxNodes) break;
        if (!bl.resolvedId) continue;

        const edgeKey = `${bl.resolvedId}::${current.id}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ source: bl.resolvedId, target: current.id });
        }

        if (!visited.has(bl.resolvedId)) {
          visited.add(bl.resolvedId);
          nodes.set(bl.resolvedId, {
            id: bl.resolvedId,
            path: bl.resolvedPath!,
            title: bl.resolvedTitle!,
          });
          queue.push({ id: bl.resolvedId, currentDepth: current.currentDepth + 1 });
        }
      }
    }

    if (nodes.size >= maxNodes) break;
  }

  return { root, nodes: [...nodes.values()], edges };
}

export function getStatus(db: DatabaseHandle) {
  const total = db.prepare("SELECT count(*) AS count FROM notes WHERE status != 'deleted'").get() as { count: number };
  const deleted = db.prepare("SELECT count(*) AS count FROM notes WHERE status = 'deleted'").get() as { count: number };
  const tags = db.prepare(`
    SELECT t.tag, count(*) AS count
    FROM tags t
    JOIN notes n ON n.id = t.note_id
    WHERE n.status != 'deleted'
    GROUP BY t.tag
    ORDER BY count DESC, t.tag
    LIMIT 20
  `).all();
  const types = db.prepare("SELECT type, count(*) AS count FROM notes WHERE status != 'deleted' GROUP BY type ORDER BY count DESC, type").all();
  return { total_notes: total.count, deleted_notes: deleted.count, top_tags: tags, types };
}

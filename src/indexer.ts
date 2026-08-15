import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { parseMarkdownNote } from "./parser.js";
import { markDeleted, sha256, upsertNote } from "./db.js";
import { toRelativePath } from "./paths.js";
import { createIgnoreChecker, getIgnorePatterns } from "./ignore.js";

const MARKDOWN_GLOBS = ["**/*.md", "**/*.mdx"];

export async function listMarkdownFiles(vaultRoot: string): Promise<string[]> {
  const isIgnored = createIgnoreChecker(vaultRoot);
  const files = await fg(MARKDOWN_GLOBS, {
    cwd: vaultRoot,
    absolute: true,
    dot: true,
    ignore: getIgnorePatterns(vaultRoot),
  });
  return files.filter((file) => !isIgnored(toRelativePath(vaultRoot, file)));
}

export async function indexFile(db: DatabaseHandle, vaultRoot: string, filePath: string): Promise<void> {
  const relativePath = toRelativePath(vaultRoot, filePath);
  const raw = await fs.readFile(filePath, "utf8");
  const stat = await fs.stat(filePath);
  const note = parseMarkdownNote(relativePath, raw);
  upsertNote(db, note, stat, raw);
}

/**
 * Recorded (size, mtime) for a path that is currently indexed, if any.
 * The files row is set by upsertNote on every index, so this is the cheap
 * unchanged-file pre-filter source.
 */
function getRecordedFile(db: DatabaseHandle, relativePath: string): { hash: string; size: number; mtime_ms: number } | undefined {
  return db.prepare("SELECT hash, size, mtime_ms FROM files WHERE path = ? AND deleted = 0").get(relativePath) as
    | { hash: string; size: number; mtime_ms: number }
    | undefined;
}

/**
 * Index a single file unless it is demonstrably unchanged: skip when the
 * on-disk (size, mtime) matches the recorded values, and defensively confirm
 * with a content hash when only the timestamps shifted (a touch / metadata
 * write). Re-raising stat/read errors lets callers decide whether they are
 * fatal or per-file.
 */
async function indexFileIfChanged(db: DatabaseHandle, vaultRoot: string, filePath: string): Promise<void> {
  const relativePath = toRelativePath(vaultRoot, filePath);
  const recorded = getRecordedFile(db, relativePath);
  if (!recorded) {
    await indexFile(db, vaultRoot, filePath);
    return;
  }

  const stat = await fs.stat(filePath);
  if (stat.size === recorded.size && Math.trunc(stat.mtimeMs) === recorded.mtime_ms) {
    return; // unchanged by cheap stat
  }

  // Stat moved but the content may be identical (touch/metadata write): hash to confirm.
  const raw = await fs.readFile(filePath, "utf8");
  if (sha256(raw) === recorded.hash) return; // content unchanged

  const note = parseMarkdownNote(relativePath, raw);
  upsertNote(db, note, stat, raw);
}

/**
 * Scoped near-realtime sync for a precise list of changed paths (from the
 * watcher). Each path is reconciled against the filesystem: removed or
 * non-markdown paths are dropped from the index, surviving markdown files are
 * re-indexed only if they changed. Paths ignored by ignore rules or outside
 * the vault are skipped. The orphans in this set are covered because their
 * missing files are removed here; a full orphan sweep piggybacks on syncVault.
 */
export async function syncChangedFiles(
  db: DatabaseHandle,
  vaultRoot: string,
  paths: string[],
): Promise<SyncResult> {
  const isIgnored = createIgnoreChecker(vaultRoot);
  let indexed = 0;
  let removed = 0;
  const errors: SyncError[] = [];

  for (const filePath of [...new Set(paths)]) {
    const relative = toRelativePath(vaultRoot, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue; // escaped vault
    if (isIgnored(relative)) continue;

    const absolute = path.isAbsolute(filePath) ? filePath : path.join(vaultRoot, filePath);
    try {
      let stat;
      try {
        stat = await fs.stat(absolute);
      } catch {
        stat = undefined;
      }
      if (!stat || !isMarkdownPath(absolute)) {
        await removeFile(db, vaultRoot, absolute);
        removed += 1;
        continue;
      }
      await indexFileIfChanged(db, vaultRoot, absolute);
      indexed += 1;
    } catch (error) {
      errors.push({ path: relative, error: errorMessage(error) });
    }
  }

  return { indexed, removed, errors };
}

export async function removeFile(db: DatabaseHandle, vaultRoot: string, filePath: string): Promise<void> {
  markDeleted(db, toRelativePath(vaultRoot, filePath));
}

export interface SyncError {
  path: string;
  error: string;
}

export interface SyncResult {
  indexed: number;
  removed: number;
  errors: SyncError[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function syncVault(db: DatabaseHandle, vaultRoot: string): Promise<SyncResult> {
  const files = await listMarkdownFiles(vaultRoot);
  const seen = new Set(files.map((file) => toRelativePath(vaultRoot, file)));
  const existing = db.prepare("SELECT path FROM files WHERE deleted = 0").all() as Array<{ path: string }>;
  let removed = 0;

  for (const row of existing) {
    if (!seen.has(row.path)) {
      markDeleted(db, row.path);
      removed += 1;
    }
  }

  let indexed = 0;
  const errors: SyncError[] = [];

  for (const file of files) {
    try {
      await indexFileIfChanged(db, vaultRoot, file);
      indexed += 1;
    } catch (error) {
      errors.push({ path: toRelativePath(vaultRoot, file), error: errorMessage(error) });
    }
  }

  return { indexed, removed, errors };
}

export function isMarkdownPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".mdx";
}

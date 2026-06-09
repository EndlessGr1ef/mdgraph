import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { parseMarkdownNote } from "./parser.js";
import { markDeleted, upsertNote } from "./db.js";
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
      await indexFile(db, vaultRoot, file);
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

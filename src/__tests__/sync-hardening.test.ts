import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getNote, getStatus } from "../db.js";
import { syncChangedFiles, syncVault } from "../indexer.js";
import { pickWindowMs, isScopedSync, shouldReschedule } from "../watcher.js";

// ---------------------------------------------------------------------------
// Helpers (reuses the temp-vault/db pattern from sync-scoped.test.ts)
// ---------------------------------------------------------------------------

interface TempVault {
  tmpDir: string;
  vaultDir: string;
  db: ReturnType<typeof openDb>;
  close: () => void;
}

function createTempVault(prefix = "mdgraph-hardening-test-"): TempVault {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const vaultDir = path.join(tmpDir, "vault");
  fs.mkdirSync(vaultDir, { recursive: true });
  const db = openDb(vaultDir);
  return {
    tmpDir,
    vaultDir,
    db,
    close: () => {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

function writeNote(vaultDir: string, name: string, content: string): string {
  const filePath = path.join(vaultDir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function filesRow(db: ReturnType<typeof openDb>, relativePath: string) {
  return db.db.prepare("SELECT hash, size, mtime_ms FROM files WHERE path = ? AND deleted = 0").get(relativePath) as
    | { hash: string; size: number; mtime_ms: number }
    | undefined;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// P1: data-safety invariants and the race fix
// ---------------------------------------------------------------------------

describe("syncChangedFiles hardening", () => {
  it("rejects a path that escapes the vault root (no index row)", async () => {
    const { vaultDir, db, close } = createTempVault("mdgraph-escape-a-");
    const escapeVault = createTempVault("mdgraph-escape-b-");
    try {
      const outsideFile = path.join(escapeVault.vaultDir, "outside.md");
      fs.writeFileSync(outsideFile, "---\nid: outside\n---\nEscaped.\n", "utf-8");
      await syncVault(db.db, vaultDir);
      expect(getStatus(db.db).total_notes).toBe(0);

      const result = await syncChangedFiles(db.db, vaultDir, [outsideFile]);

      // No note from outside the vault may be written into our index.
      expect(result.indexed).toBe(0);
      expect(getStatus(db.db).total_notes).toBe(0);
      expect(filesRow(db, path.relative(vaultDir, outsideFile))).toBeUndefined();
      expect(db.db.prepare("SELECT count(*) AS c FROM files").get() as { c: number }).toEqual({ c: 0 });
    } finally {
      escapeVault.close();
      close();
    }
  });

  it("rejects a path ignored by .mdgraphignore rules (private/ dir)", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.writeFileSync(path.join(vaultDir, ".mdgraphignore"), "private/**\n", "utf-8");
      const privateDir = path.join(vaultDir, "private");
      fs.mkdirSync(privateDir, { recursive: true });
      const ignoredPath = writeNote(privateDir, "secret.md", "---\nid: secret\n---\nIgnored.\n");
      writeNote(vaultDir, "public.md", "---\nid: public\n---\nVisible.\n");
      await syncVault(db.db, vaultDir);

      // seed index state first so the assertion is about the scoped call, not the vault
      const before = getStatus(db.db).total_notes;

      const result = await syncChangedFiles(db.db, vaultDir, [ignoredPath]);

      expect(result.indexed).toBe(0);
      expect(getNote(db.db, "secret")).toBeUndefined();
      expect(getStatus(db.db).total_notes).toBe(before);
    } finally {
      close();
    }
  });

  it("rejects a path under the always-ignored .mdgraph dir", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const mdgraphDir = path.join(vaultDir, ".mdgraph");
      fs.mkdirSync(mdgraphDir, { recursive: true });
      const metaPath = writeNote(mdgraphDir, "state.md", "---\nid: meta\n---\nIndex metadata.\n");
      await syncVault(db.db, vaultDir);

      const result = await syncChangedFiles(db.db, vaultDir, [metaPath]);

      expect(result.indexed).toBe(0);
      expect(getNote(db.db, "meta")).toBeUndefined();
      expect(filesRow(db, ".mdgraph/state.md")).toBeUndefined();
    } finally {
      close();
    }
  });

  it("skips a re-parse when only mtime changed (content-hash confirmation)", async () => {
    const parser = await import("../parser.js");
    const parseSpy = vi.spyOn(parser, "parseMarkdownNote");

    const { vaultDir, db, close } = createTempVault();
    try {
      const filePath = writeNote(vaultDir, "note.md", "---\nid: note\n---\nSame content.\n");
      await syncVault(db.db, vaultDir);
      expect(parseSpy).toHaveBeenCalledTimes(1);
      const recordedBefore = filesRow(db, "note.md")!;
      expect(recordedBefore).toBeDefined();

      // Same size + same content, only mtime differs (a touch).
      const stat = fs.statSync(filePath);
      const newMtime = Math.trunc(stat.mtimeMs) + 5_000;
      fs.utimesSync(filePath, new Date(newMtime), new Date(newMtime));

      parseSpy.mockClear();
      const result = await syncVault(db.db, vaultDir);
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);

      // The content hash confirmation proved the bytes are identical, so the
      // file was not re-parsed and its hash state is untouched.
      expect(parseSpy).not.toHaveBeenCalled();
      expect(filesRow(db, "note.md")!.hash).toBe(recordedBefore.hash);
    } finally {
      close();
    }
  });

  it("preserves an unmet needsFullScan demand across a completed flush", async () => {
    // The race: a full-scan demand (e.g. a directory removed mid-flush) leaves
    // zero pending paths but an unmet needsFullScan. The flush finally must
    // re-arm on the demand alone, or the deletion is swallowed until the next
    // event/restart.
    expect(shouldReschedule(0, true)).toBe(true);
    // Sanity: an idle flush with no backlog and no full-scan demand stays quiet.
    expect(shouldReschedule(0, false)).toBe(false);
    // Mid-flush file events (surviving the startedAt watermark) still re-arm.
    expect(shouldReschedule(3, false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P2: pure scheduling-logic decisions
// ---------------------------------------------------------------------------

describe("watcher scheduling logic", () => {
  it("picks the quick quiet window for a tiny pending set, the full debounce otherwise", () => {
    expect(pickWindowMs(1)).toBe(300);
    expect(pickWindowMs(2)).toBe(300);
    expect(pickWindowMs(3)).toBe(2000);
    expect(pickWindowMs(100)).toBe(2000);
  });

  it("stays scoped up to the 500-pending ceiling, goes full above it", () => {
    expect(isScopedSync(false, 1)).toBe(true);
    expect(isScopedSync(false, 500)).toBe(true); // 500 == boundary → scoped (strict >)
    expect(isScopedSync(false, 501)).toBe(false); // 501 > 500 → full scan fallback
    expect(isScopedSync(true, 1)).toBe(false); // needsFullScan forces full regardless
    expect(isScopedSync(false, 0)).toBe(false); // empty set cannot be scoped
  });

  it("re-arms when un-consumed backlog survives a flush (watermark survival)", () => {
    // Events that land after the flush's startedAt watermark remain pending and
    // must re-arm; shouldReschedule encodes exactly that outcome.
    expect(shouldReschedule(4, false)).toBe(true);
  });
});

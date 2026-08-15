import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getNote, getStatus } from "../db.js";import { syncVault, syncChangedFiles } from "../indexer.js";
import { toRelativePath } from "../paths.js";
import { watchVault } from "../watcher.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TempVault {
  tmpDir: string;
  vaultDir: string;
  db: ReturnType<typeof openDb>;
  close: () => void;
}

function createTempVault(): TempVault {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-scoped-test-")));
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

async function waitFor<T>(readValue: () => T | undefined, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = readValue();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for condition");
}

async function waitForWatcherReady(watcher: ReturnType<typeof watchVault>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for watcher ready")), 5_000);
    watcher.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
    watcher.once("error", reject);
  });
  // Give the initial catch-up full-scan (triggered on ready) a moment to settle.
  await new Promise((resolve) => setTimeout(resolve, 150));
}

function filesRow(db: ReturnType<typeof openDb>, relativePath: string) {
  return db.db.prepare("SELECT hash, size, mtime_ms FROM files WHERE path = ?").get(relativePath) as
    | { hash: string; size: number; mtime_ms: number }
    | undefined;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoped near-realtime sync", () => {
  it("single-file edit under watch syncs only that file via scoped sync", async () => {
    const indexer = await import("../indexer.js");
    const syncVaultSpy = vi.spyOn(indexer, "syncVault");
    const syncChangedSpy = vi.spyOn(indexer, "syncChangedFiles");

    const { vaultDir, db, close } = createTempVault();
    try {
      const aPath = writeNote(vaultDir, "a.md", "---\nid: a\n---\nVersion 1\n");
      writeNote(vaultDir, "b.md", "---\nid: b\n---\nStable\n");
      await syncVault(db.db, vaultDir);
      const bBefore = filesRow(db, "b.md")!.hash;
      syncVaultSpy.mockClear();
      syncChangedSpy.mockClear();

      const watcher = watchVault(db.db, vaultDir);
      try {
        await waitForWatcherReady(watcher);
        syncVaultSpy.mockClear();
        syncChangedSpy.mockClear();

        fs.writeFileSync(aPath, "---\nid: a\n---\nVersion 2 edited via watch\n", "utf-8");

        await waitFor(() => {
          const note = getNote(db.db, "a");
          return note?.body.includes("Version 2 edited via watch") ? true : undefined;
        });

        // Scoped path was used, not the full-sync fallback.
        expect(syncVaultSpy).not.toHaveBeenCalled();
        expect(syncChangedSpy).toHaveBeenCalled();
        const scopedPaths = syncChangedSpy.mock.calls[0]?.[2] as string[] | undefined;
        expect(scopedPaths).toContain(path.resolve(vaultDir, "a.md"));
        expect(scopedPaths).not.toContain(path.resolve(vaultDir, "b.md"));

        // The untouched note's content hash is unchanged → it was not re-parsed.
        expect(filesRow(db, "b.md")!.hash).toBe(bBefore);
      } finally {
        await watcher.close();
      }
    } finally {
      close();
    }
  });

  it("directory removal under watch triggers full-sync fallback and cleans rows", async () => {
    const indexer = await import("../indexer.js");
    const syncVaultSpy = vi.spyOn(indexer, "syncVault");
    const syncChangedSpy = vi.spyOn(indexer, "syncChangedFiles");

    const { vaultDir, db, close } = createTempVault();
    try {
      const subDir = path.join(vaultDir, "doomed");
      fs.mkdirSync(subDir, { recursive: true });
      writeNote(subDir, "inside.md", "---\nid: inside\n---\nIn a directory.\n");
      writeNote(vaultDir, "root.md", "---\nid: root\n---\nAt the root.\n");
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "inside")).toBeDefined();

      const watcher = watchVault(db.db, vaultDir);
      try {
        await waitForWatcherReady(watcher);
        syncVaultSpy.mockClear();
        syncChangedSpy.mockClear();

        fs.rmSync(subDir, { recursive: true, force: true });

        // Directory deletion cannot be described as a precise path list, so a
        // full scan must run and clean up the orphaned note.
        await waitFor(() => (syncVaultSpy.mock.calls.length > 0 ? true : undefined));
        expect(syncChangedSpy).not.toHaveBeenCalled();

        await waitFor(() => (getNote(db.db, "inside")?.status === "deleted" ? true : undefined));
        expect(getStatus(db.db).total_notes).toBe(1);
        expect(getNote(db.db, "root")).toBeDefined();
      } finally {
        await watcher.close();
      }
    } finally {
      close();
    }
  });
});

describe("consistency reconciliation", () => {
  it("syncVault skips re-parsing unchanged files", async () => {
    const parser = await import("../parser.js");
    const parseSpy = vi.spyOn(parser, "parseMarkdownNote");

    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "note.md", "---\nid: note\n---\nSame content.\n");
      await syncVault(db.db, vaultDir);
      expect(parseSpy).toHaveBeenCalledTimes(1);

      parseSpy.mockClear();
      const result = await syncVault(db.db, vaultDir);
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);

      // The unchanged file was never re-parsed → cheap (size/mtime) skip.
      expect(parseSpy).not.toHaveBeenCalled();
    } finally {
      close();
    }
  });

  it("syncVault re-indexes a changed file", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const filePath = writeNote(vaultDir, "mutable.md", "---\nid: mutable\n---\nBefore.\n");
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "mutable")?.body).toContain("Before.");

      fs.writeFileSync(filePath, "---\nid: mutable\n---\nAfter the change.\n", "utf-8");
      const result = await syncVault(db.db, vaultDir);

      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(getNote(db.db, "mutable")?.body).toContain("After the change.");
    } finally {
      close();
    }
  });

  it("orphan rows are cleaned up after a scoped sync", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "kept.md", "---\nid: kept\n---\nStays.\n");
      const doomedPath = writeNote(vaultDir, "doomed.md", "---\nid: doomed\n---\nRemoved behind the watcher's back.\n");
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "doomed")).toBeDefined();

      // Simulate a watch-missed deletion: the file is gone but no event fired.
      fs.rmSync(doomedPath, { force: true });
      await syncChangedFiles(db.db, vaultDir, [path.resolve(vaultDir, "doomed.md")]);

      const note = getNote(db.db, "doomed");
      expect(note).toBeDefined();
      expect(note!.status).toBe("deleted");
      expect(getStatus(db.db).total_notes).toBe(1);
      expect(getNote(db.db, "kept")).toBeDefined();
    } finally {
      close();
    }
  });
});

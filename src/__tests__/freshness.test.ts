import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getNote, openDb, searchNotes } from "../db.js";
import { ensureNoteFresh, syncVault } from "../indexer.js";
import { ServedNotesStore } from "../explore.js";
import { getNoteWithFreshness, registerExploreNotesTool } from "../mcp.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors core.test.ts's temp-vault pattern)
// ---------------------------------------------------------------------------

interface TempVault {
  vaultDir: string;
  db: ReturnType<typeof openDb>;
  close: () => void;
}

function createTempVault(): TempVault {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-freshness-test-")));
  const vaultDir = path.join(tmpDir, "vault");
  fs.mkdirSync(vaultDir, { recursive: true });
  const db = openDb(vaultDir);
  return {
    vaultDir,
    db,
    close: () => {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

function writeNote(vaultDir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(vaultDir, name), content, "utf-8");
}

function longBody(prefix: string, lines: number): string {
  return Array.from({ length: lines }, (_, i) => `${prefix} line ${i + 1} of a longer note with the marker keyword.`)
    .join("\n");
}

interface ExplorePayload {
  answerNotes: Array<{ id: string; body: string; deduped: boolean; truncated: boolean; stale?: boolean }>;
  relatedPointers: Array<{ id: string }>;
  warning?: string;
}

async function connectExploreTool(vaultDir: string, db: DatabaseHandle, served: ServedNotesStore) {
  const server = new McpServer({ name: "mdgraph-freshness", version: "0.0.0" });
  registerExploreNotesTool(server, db, served, vaultDir);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "mdgraph-freshness-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function explorePayload(client: Client, query: string): Promise<ExplorePayload> {
  const result = await client.callTool({ name: "mdgraph_explore_notes", arguments: { query } });
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0].text) as ExplorePayload;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ensureNoteFresh", () => {
  it("reports fresh without reindexing an unchanged note", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "steady.md", "---\nid: steady\ntitle: Steady\n---\nPlain body.");
      await syncVault(db.db, vaultDir);

      await expect(ensureNoteFresh(db.db, vaultDir, "steady")).resolves.toEqual({
        fresh: true,
        reindexed: false,
        stale: false,
      });
    } finally {
      close();
    }
  });

  it("reindexes an unsynced on-disk change so a get_note read returns the new content", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "live.md", `---\nid: live\ntitle: Live\n---\n${longBody("original", 10)}`);
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "live")?.body).toContain("original line 1");

      // Modify on disk without syncing: this is the mdgraph_get_note handler path.
      writeNote(vaultDir, "live.md", `---\nid: live\ntitle: Live\n---\n${longBody("revised", 12)}`);
      const freshness = await ensureNoteFresh(db.db, vaultDir, "live");

      expect(freshness).toEqual({ fresh: false, reindexed: true, stale: false });
      expect(getNote(db.db, "live")?.body).toContain("revised line 1");
      expect(getNote(db.db, "live")?.body).not.toContain("original line 1");
    } finally {
      close();
    }
  });

  it("stays fresh when only the mtime changed and the content hash matches", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const content = `---\nid: touched\ntitle: Touched\n---\n${longBody("touch", 10)}`;
      writeNote(vaultDir, "touched.md", content);
      await syncVault(db.db, vaultDir);

      const future = new Date(Date.now() + 10_000);
      fs.utimesSync(path.join(vaultDir, "touched.md"), future, future);

      await expect(ensureNoteFresh(db.db, vaultDir, "touched")).resolves.toEqual({
        fresh: true,
        reindexed: false,
        stale: false,
      });
    } finally {
      close();
    }
  });

  it("detects a same-size content change through the sha256 path", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const original = `---\nid: samesize\ntitle: Same\n---\n${longBody("same", 10)}`;
      writeNote(vaultDir, "samesize.md", original);
      await syncVault(db.db, vaultDir);

      // Same byte length, different bytes, and a new mtime: only the hash can tell.
      const revised = original.replace("same line 1", "SAME line 1");
      expect(revised.length).toBe(original.length);
      writeNote(vaultDir, "samesize.md", revised);
      const future = new Date(Date.now() + 10_000);
      fs.utimesSync(path.join(vaultDir, "samesize.md"), future, future);

      await expect(ensureNoteFresh(db.db, vaultDir, "samesize")).resolves.toEqual({
        fresh: false,
        reindexed: true,
        stale: false,
      });
      expect(getNote(db.db, "samesize")?.body).toContain("SAME line 1");
    } finally {
      close();
    }
  });

  it("get_note reads through the freshness check before returning the body", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "fast.md", `---\nid: fast\ntitle: Fast\n---\n${longBody("before", 10)}`);
      await syncVault(db.db, vaultDir);
      writeNote(vaultDir, "fast.md", `---\nid: fast\ntitle: Fast\n---\n${longBody("after", 10)}`);

      const payload = await getNoteWithFreshness(db.db, vaultDir, "fast");

      // Reindexing must happen first; reading the cached row would return "before".
      expect("body" in payload ? payload.body : "").toContain("after line 1");
    } finally {
      close();
    }
  });

  it("reports stale when the inline reindex fails", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "broken.md", "---\nid: broken\ntitle: Broken\n---\nOriginal body.");
      await syncVault(db.db, vaultDir);

      // Replace the file with a directory: stat/read now fail, so reindexing cannot run.
      const filePath = path.join(vaultDir, "broken.md");
      fs.rmSync(filePath);
      fs.mkdirSync(filePath);

      await expect(ensureNoteFresh(db.db, vaultDir, "broken")).resolves.toEqual({
        fresh: false,
        reindexed: false,
        stale: true,
      });
    } finally {
      close();
    }
  });

  it("reports fresh for an unknown note id so not-found handling stays in charge", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      await expect(ensureNoteFresh(db.db, vaultDir, "missing")).resolves.toEqual({
        fresh: true,
        reindexed: false,
        stale: false,
      });
    } finally {
      close();
    }
  });
});

describe("read-time freshness in mdgraph_explore_notes", () => {
  it("re-runs the exploration so answer bodies reflect an out-of-band edit", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("freshnessprobe", 10)}`);
      writeNote(vaultDir, "b.md", `---\nid: b\ntitle: Beta\n---\n${longBody("freshnessprobe", 10)}`);
      await syncVault(db.db, vaultDir);

      const topId = searchNotes(db.db, "freshnessprobe", { limit: 50 })[0].id;
      const otherId = topId === "a" ? "b" : "a";
      const topPath = getNote(db.db, topId)!.path;
      writeNote(vaultDir, topPath, `---\nid: ${topId}\ntitle: Edited\n---\n${longBody("freshnessprobe", 10)}\nrevised marker`);

      const { client, close: closeClient } = await connectExploreTool(vaultDir, db.db, new ServedNotesStore());
      try {
        const payload = await explorePayload(client, "freshnessprobe");
        const edited = payload.answerNotes.find((note) => note.id === topId);
        const untouched = payload.answerNotes.find((note) => note.id === otherId);

        expect(edited?.body).toContain("revised marker");
        expect(edited?.stale).toBeUndefined();
        // The unchanged note is re-sent in full, not replaced by a dedup pointer.
        expect(untouched?.deduped).toBe(false);
        expect(untouched?.body).toContain("freshnessprobe line 1");
        expect(payload.warning).toBeUndefined();
      } finally {
        await closeClient();
      }
    } finally {
      close();
    }
  });

  it("flags stale answer notes and adds one warning when reindexing fails", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "stuck.md", `---\nid: stuck\ntitle: Stuck\n---\n${longBody("stuckprobe", 10)}`);
      await syncVault(db.db, vaultDir);

      const filePath = path.join(vaultDir, "stuck.md");
      fs.rmSync(filePath);
      fs.mkdirSync(filePath);

      const { client, close: closeClient } = await connectExploreTool(vaultDir, db.db, new ServedNotesStore());
      try {
        const payload = await explorePayload(client, "stuckprobe");
        expect(payload.answerNotes[0].id).toBe("stuck");
        expect(payload.answerNotes[0].stale).toBe(true);
        expect(payload.answerNotes[0].body).toContain("stuckprobe line 1");
        expect(payload.warning).toContain("stale");
      } finally {
        await closeClient();
      }
    } finally {
      close();
    }
  });
});

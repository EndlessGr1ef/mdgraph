import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getNote, openDb, sha256 } from "../db.js";
import { syncVault } from "../indexer.js";
import { exploreNotes, isWeakMatch, ServedNotesStore, LOW_CONFIDENCE_NOTE, EXPLORE_LIMITS } from "../explore.js";
import { registerExploreNotesTool } from "../mcp.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors core.test.ts's temp-vault pattern)
// ---------------------------------------------------------------------------

interface TempVault {
  vaultDir: string;
  db: ReturnType<typeof openDb>;
  close: () => void;
}

function createTempVault(): TempVault {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-explore-test-")));
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mdgraph_explore_notes", () => {
  // 1. Answer notes (full content) + pointer list for related.
  it("returns answer notes in full plus one-line pointers for related", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Six notes matching the same keyword: top ones become answers, the
      // rest (past maxNotes) become pointers.
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("alpha", 10)}`);
      writeNote(vaultDir, "b.md", `---\nid: b\ntitle: Beta\n---\n${longBody("alpha", 10)}`);
      writeNote(vaultDir, "c.md", `---\nid: c\ntitle: Gamma\n---\n${longBody("alpha", 10)}`);
      writeNote(vaultDir, "d.md", `---\nid: d\ntitle: Delta\n---\n${longBody("alpha", 10)}`);
      writeNote(vaultDir, "e.md", `---\nid: e\ntitle: Epsilon\n---\n${longBody("alpha", 10)}`);
      writeNote(vaultDir, "f.md", `---\nid: f\ntitle: Zeta\n---\n${longBody("alpha", 10)}`);
      await syncVault(db.db, vaultDir);

      const result = exploreNotes(db.db, "alpha");

      // Default maxNotes = 3 answer notes, full bodies present.
      expect(result.answerNotes).toHaveLength(3);
      for (const answer of result.answerNotes) {
        expect(answer.deduped).toBe(false);
        expect(answer.body).toContain("alpha line 1");
        expect(getNote(db.db, answer.id)?.body).toBe(answer.body);
      }

      // Remaining candidates become pointers (id/title/path/tags, no body).
      expect(result.relatedPointers.length).toBeGreaterThan(0);
      for (const p of result.relatedPointers) {
        expect(p.id).toBeDefined();
        expect(p.title).toBeDefined();
        expect(p.path).toBeDefined();
      }
      const pointerIds = result.relatedPointers.map((p) => p.id);
      const answerIds = result.answerNotes.map((a) => a.id);
      expect(pointerIds.some((id) => answerIds.includes(id))).toBe(false);

      // Markdown has both sections and no footnote for a confident match.
      expect(result.markdown).toContain("## Answer notes");
      expect(result.markdown).toContain("## Related (pointers)");
      expect(result.markdown).not.toContain("## Note");
      expect(result.lowConfidence).toBe(false);
    } finally {
      close();
    }
  });

  it("honors an explicit maxNotes within the 2-5 clamp", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      for (let i = 0; i < 6; i++) {
        writeNote(vaultDir, `n${i}.md`, `---\nid: n-${i}\ntitle: N ${i}\n---\n${longBody("clamp", 10)}`);
      }
      await syncVault(db.db, vaultDir);

      expect(exploreNotes(db.db, "clamp", { maxNotes: 5 }).answerNotes).toHaveLength(5);
      // Clamps below 2 to 2.
      expect(exploreNotes(db.db, "clamp", { maxNotes: 1 }).answerNotes).toHaveLength(2);
      // Clamps above 5 to 5.
      expect(exploreNotes(db.db, "clamp", { maxNotes: 99 }).answerNotes).toHaveLength(5);
    } finally {
      close();
    }
  });

  // 2. Weak / absent match produces the low-confidence footnote.
  it("adds a low-confidence footnote when nothing matches", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("alpha", 10)}`);
      await syncVault(db.db, vaultDir);

      const result = exploreNotes(db.db, "totally-unrelated-zzz");
      expect(result.lowConfidence).toBe(true);
      expect(result.answerNotes).toHaveLength(0);
      expect(result.relatedPointers).toHaveLength(0);
      expect(result.note).toBe(LOW_CONFIDENCE_NOTE);
      expect(result.markdown).toContain("## Note");
      expect(result.markdown).toContain(LOW_CONFIDENCE_NOTE);
    } finally {
      close();
    }
  });

  it("isWeakMatch flags a top result that has no strong entry token", async () => {
    // None of the top result's title/path/snippet contains the query token.
    expect(isWeakMatch("alpha", [{ title: "Generic", path: "note.md", snippet: "body text" }])).toBe(true);
    // The token appears in the title → strong entry point.
    expect(isWeakMatch("alpha", [{ title: "Alpha doc", path: "note.md", snippet: "body text" }])).toBe(false);
    // The token appears in the snippet → strong entry point.
    expect(isWeakMatch("alpha", [{ title: "Generic", path: "note.md", snippet: "about alpha here" }])).toBe(false);
  });

  it("isWeakMatch returns true for an empty result set", () => {
    expect(isWeakMatch("anything", [])).toBe(true);
  });

  // 3. Session dedup: same note served twice → pointer on the second call.
  it("replaces an unchanged already-served body with a pointer", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("dedup", 10)}`);
      await syncVault(db.db, vaultDir);

      const store = new ServedNotesStore();

      const first = exploreNotes(db.db, "dedup", { served: store });
      expect(first.answerNotes).toHaveLength(1);
      expect(first.answerNotes[0].deduped).toBe(false);
      expect(first.answerNotes[0].body).toContain("dedup line 1");

      const second = exploreNotes(db.db, "dedup", { served: store });
      expect(second.answerNotes).toHaveLength(1);
      expect(second.answerNotes[0].deduped).toBe(true);
      expect(second.answerNotes[0].body).toContain("already served earlier in this conversation");
      expect(second.answerNotes[0].body).toContain("Not repeated");
      expect(second.answerNotes[0].body).not.toContain("dedup line 1");
    } finally {
      close();
    }
  });

  // 4. Edited note (different body_hash) → served in full again.
  it("re-serves in full when a note is edited between calls", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("original", 10)}`);
      await syncVault(db.db, vaultDir);

      const store = new ServedNotesStore();
      const first = exploreNotes(db.db, "original", { served: store });
      expect(first.answerNotes[0].deduped).toBe(false);

      // Edit the note on disk and reindex → body_hash changes.
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("revised", 10)}`);
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "a")?.body).not.toContain("original");

      const second = exploreNotes(db.db, "revised", { served: store });
      expect(second.answerNotes[0].deduped).toBe(false);
      expect(second.answerNotes[0].body).toContain("revised line 1");
    } finally {
      close();
    }
  });

  // 5. Tiny note exception: small body is re-served, not pointerized.
  it("re-serves a tiny body instead of pointerizing it", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Body of a single short line, well under the 8-line minimum.
      writeNote(vaultDir, "tiny.md", "---\nid: tiny\ntitle: Tiny\n---\nJust a stub.");
      await syncVault(db.db, vaultDir);

      const store = new ServedNotesStore();
      const first = exploreNotes(db.db, "Tiny", { served: store });
      expect(first.answerNotes[0].deduped).toBe(false);

      const second = exploreNotes(db.db, "Tiny", { served: store });
      // Tiny bodies are exempt from dedup, so the second call re-serves.
      expect(second.answerNotes[0].deduped).toBe(false);
      expect(second.answerNotes[0].body).toBe("Just a stub.");
    } finally {
      close();
    }
  });

  it("records the sha256 body hash when serving, so edits are detected", () => {
    const note = { body: longBody("hash", 10) };
    const hash = sha256(note.body);
    const store = new ServedNotesStore();
    store.set("a", hash);
    expect(store.get("a")?.bodyHash).toBe(hash);
    // Different body → different hash.
    expect(store.get("a")?.bodyHash).not.toBe(sha256("different content"));
  });
});

describe("ServedNotesStore LRU bound", () => {
  it("caps size at MAX_SERVED, evicting oldest and retaining newest", () => {
    const store = new ServedNotesStore();
    // Ensure we actually push past the configured bound.
    const total = EXPLORE_LIMITS.MAX_SERVED + 50;
    expect(total).toBeGreaterThan(EXPLORE_LIMITS.MAX_SERVED);

    for (let i = 0; i < total; i++) {
      store.set(`id-${i}`, `hash-${i}`);
    }

    // Size never exceeds the bound.
    expect((store as unknown as { records: Map<string, unknown> }).records.size).toBe(EXPLORE_LIMITS.MAX_SERVED);

    // Oldest inserted entries were evicted (LRU head), newest retained.
    expect(store.get("id-0")).toBeUndefined();
    expect(store.get(`id-${total - 1}`)).toBeDefined();

    // Re-serving an old-but-retained id moves it to the tail (survives next eviction).
    store.set("id-50", `hash-50`);
    store.set(`id-${total}`, `hash-${total}`);
    expect(store.get("id-50")).toBeDefined();
    expect((store as unknown as { records: Map<string, unknown> }).records.size).toBe(EXPLORE_LIMITS.MAX_SERVED);
  });
});

describe("mdgraph_explore_notes MCP registration", () => {
  it("registers the tool and validates its input schema via an in-memory client", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", `---\nid: a\ntitle: Alpha\n---\n${longBody("probe", 10)}`);
      await syncVault(db.db, vaultDir);

      const server = new McpServer({ name: "mdgraph-test", version: "0.0.0" });
      registerExploreNotesTool(server, db.db, new ServedNotesStore());

      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "mdgraph-test-client", version: "0.0.0" });
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      try {
        // Valid: bare { query } and { query, maxNotes } accepted.
        const okBare = await client.callTool({ name: "mdgraph_explore_notes", arguments: { query: "probe" } });
        expect(okBare.isError).toBeFalsy();
        expect(JSON.stringify(okBare.content)).toContain("probe");

        const okMax = await client.callTool({
          name: "mdgraph_explore_notes",
          arguments: { query: "probe", maxNotes: 3 },
        });
        expect(okMax.isError).toBeFalsy();

        // Invalid: empty query and out-of-range maxNotes rejected by the schema.
        const emptyQuery = await client.callTool({
          name: "mdgraph_explore_notes",
          arguments: { query: "" },
        });
        expect(emptyQuery.isError).toBe(true);

        const badMax = await client.callTool({
          name: "mdgraph_explore_notes",
          arguments: { maxNotes: 6 },
        });
        expect(badMax.isError).toBe(true);
      } finally {
        await client.close();
        await server.close();
      }
    } finally {
      close();
    }
  });
});

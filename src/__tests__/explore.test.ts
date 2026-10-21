import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getNote, openDb, searchNotes, sha256 } from "../db.js";
import { syncVault } from "../indexer.js";
import {
  exploreNotes,
  isWeakMatch,
  ServedNotesStore,
  LOW_CONFIDENCE_NOTE,
  EXPLORE_LIMITS,
  sliceBody,
} from "../explore.js";
import { extractHeadings } from "../parser.js";
import { MCP_INSTRUCTIONS } from "../instructions.js";
import { createMcpServer, registerExploreNotesTool } from "../mcp.js";

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

  // 3b. A truncated serve is not reusable: the reader never saw the whole body.
  it("re-serves a truncated note instead of pointerizing it", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "long.md", `---\nid: long\ntitle: Long\n---\n${longBody("longserve", 220)}`);
      await syncVault(db.db, vaultDir);
      const fullLength = getNote(db.db, "long")!.body.length;

      const store = new ServedNotesStore();
      const first = exploreNotes(db.db, "longserve", { served: store });
      expect(first.answerNotes[0].deduped).toBe(false);
      expect(first.answerNotes[0].truncated).toBe(true);
      expect(first.answerNotes[0].body.length).toBeLessThan(fullLength);
      expect(store.get("long")?.servedChars).toBe(first.answerNotes[0].body.length);

      const second = exploreNotes(db.db, "longserve", { served: store });
      expect(second.answerNotes[0].deduped).toBe(false);
      expect(second.answerNotes[0].truncated).toBe(true);
      expect(second.answerNotes[0].body).toContain("longserve line 1");
    } finally {
      close();
    }
  });

  it("records the sha256 body hash when serving, so edits are detected", () => {
    const note = { body: longBody("hash", 10) };
    const hash = sha256(note.body);
    const store = new ServedNotesStore();
    store.set("a", hash, note.body.length);
    expect(store.get("a")?.bodyHash).toBe(hash);
    expect(store.get("a")?.servedChars).toBe(note.body.length);
    // Different body → different hash.
    expect(store.get("a")?.bodyHash).not.toBe(sha256("different content"));
  });
});

describe("output budget", () => {
  it("pins the documented character caps", () => {
    expect(EXPLORE_LIMITS.MAX_TOTAL_CHARS).toBe(12000);
    expect(EXPLORE_LIMITS.MAX_NOTE_CHARS).toBe(6000);
  });

  it("slices an oversized note and keeps the wire payload within 12000 characters", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      for (let i = 0; i < 3; i++) {
        writeNote(
          vaultDir,
          `budget-${i}.md`,
          `---\nid: budget-${i}\ntitle: Budget ${i}\n---\n${longBody("budget", 220)}`,
        );
      }
      await syncVault(db.db, vaultDir);

      const rankedIds = searchNotes(db.db, "budget", { limit: 50 }).map((r) => r.id);
      const result = exploreNotes(db.db, "budget", { maxNotes: 3 });

      // The top-ranked note stays first even though its body is now sliced.
      expect(result.answerNotes[0].id).toBe(rankedIds[0]);
      expect(result.answerNotes[0].deduped).toBe(false);
      expect(result.answerNotes[0].truncated).toBe(true);
      expect(result.answerNotes[0].body.length).toBeLessThanOrEqual(6000);

      const bodyChars = result.answerNotes.reduce((sum, answer) => sum + answer.body.length, 0);
      expect(bodyChars).toBeLessThanOrEqual(11200);
      // The wire text is pretty-printed, so measure that form.
      expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(12000);

      // The stale annotation the MCP layer appends must also fit inside the cap.
      const annotated = {
        ...result,
        answerNotes: result.answerNotes.map((answer) => ({ ...answer, stale: true })),
        warning: "Index is stale: the note changed on disk but could not be re-indexed; run mdgraph_sync to refresh.",
      };
      expect(JSON.stringify(annotated, null, 2).length).toBeLessThanOrEqual(12000);
      // The payload must not carry bodies twice via a rendered markdown copy.
      expect("markdown" in result).toBe(false);
    } finally {
      close();
    }
  });

  it("keeps every answer at or above the 1000-character floor", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      for (let i = 0; i < 3; i++) {
        writeNote(
          vaultDir,
          `scarce-${i}.md`,
          `---\nid: scarce-${i}\ntitle: Scarce ${i}\n---\n${longBody("scarce", 220)}`,
        );
      }
      await syncVault(db.db, vaultDir);

      const rankedIds = searchNotes(db.db, "scarce", { limit: 50 }).map((r) => r.id);
      const result = exploreNotes(db.db, "scarce", { maxNotes: 3 });

      // The third note's allowance would fall under the floor, so it becomes a pointer.
      expect(result.answerNotes.map((answer) => answer.id)).toEqual(rankedIds.slice(0, 2));
      expect(result.relatedPointers.map((pointer) => pointer.id)).toContain(rankedIds[2]);
      for (const answer of result.answerNotes) {
        expect(answer.body.length).toBeGreaterThanOrEqual(1000);
      }
    } finally {
      close();
    }
  });

  it("does not charge a deduped note against the body budget", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      for (let i = 0; i < 2; i++) {
        writeNote(
          vaultDir,
          `served-${i}.md`,
          `---\nid: served-${i}\ntitle: Served ${i}\n---\n${longBody("budgetdedup", 220)}`,
        );
      }
      await syncVault(db.db, vaultDir);

      // Learn the rank order, then mark the top note as already served unchanged.
      const topId = exploreNotes(db.db, "budgetdedup").answerNotes[0].id;
      const fullBody = getNote(db.db, topId)!.body;
      const store = new ServedNotesStore();
      store.set(topId, sha256(fullBody), fullBody.length);

      const result = exploreNotes(db.db, "budgetdedup", { served: store });

      expect(result.answerNotes[0].id).toBe(topId);
      expect(result.answerNotes[0].deduped).toBe(true);
      expect(result.answerNotes[0].truncated).toBe(false);
      // The following note gets the full per-note cap, not cap minus a body.
      expect(result.answerNotes[1].body.length).toBeGreaterThan(5900);
    } finally {
      close();
    }
  });

  it("keeps every budget-dropped note visible when the payload is trimmed", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const dirName = "d".repeat(120);
      fs.mkdirSync(path.join(vaultDir, dirName), { recursive: true });
      for (let i = 0; i < 14; i++) {
        fs.writeFileSync(
          path.join(vaultDir, dirName, `note-${i}.md`),
          `---\nid: wide-${i}\ntitle: Wide ${i}\n---\n${longBody("budgetcap", 220)}`,
          "utf-8",
        );
      }
      await syncVault(db.db, vaultDir);

      const rankedIds = searchNotes(db.db, "budgetcap", { limit: 50 }).map((r) => r.id);
      const result = exploreNotes(db.db, "budgetcap", { maxNotes: 4 });

      // 2 answers, 2 budget-dropped notes, and 10 ranked pointers before trimming.
      expect(result.answerNotes).toHaveLength(2);
      expect(result.answerNotes[0].path.length).toBeGreaterThanOrEqual(120);
      const pointerIds = result.relatedPointers.map((pointer) => pointer.id);
      expect(pointerIds).toContain(rankedIds[2]);
      expect(pointerIds).toContain(rankedIds[3]);
      expect(result.relatedPointers).toHaveLength(12);
      expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(12000);
    } finally {
      close();
    }
  });

  it("shrinks the last answer body before dropping any pointer", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const longTitle = "T".repeat(400);
      for (let i = 0; i < 4; i++) {
        writeNote(
          vaultDir,
          `longtitle-${i}.md`,
          `---\nid: longtitle-${i}\ntitle: ${longTitle} ${i}\n---\n${longBody("shortencap", 220)}`,
        );
      }
      await syncVault(db.db, vaultDir);

      const result = exploreNotes(db.db, "shortencap", { maxNotes: 2 });

      // Two pointers must survive while the lower-ranked body gives up characters.
      expect(result.answerNotes).toHaveLength(2);
      expect(result.relatedPointers).toHaveLength(2);
      expect(result.answerNotes[0].body.length).toBeGreaterThan(5900);
      expect(result.answerNotes[1].body.length).toBeLessThan(5000);
      expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(12000);
    } finally {
      close();
    }
  });

  it("keeps five stale answers inside the wire cap", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const dirName = "s".repeat(120);
      fs.mkdirSync(path.join(vaultDir, dirName), { recursive: true });
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
          path.join(vaultDir, dirName, `stale-${i}.md`),
          `---\nid: stale-${i}\ntitle: Stale ${i}\n---\n${longBody("stale5", 34)}`,
          "utf-8",
        );
      }
      // This pointer pushes the unannotated payload to the reserve boundary.
      fs.writeFileSync(
        path.join(vaultDir, dirName, "pointer.md"),
        `---\nid: stale-pointer\ntitle: P${"x".repeat(40)}\n---\nstale5 pointer stub.`,
        "utf-8",
      );
      await syncVault(db.db, vaultDir);

      const result = exploreNotes(db.db, "stale5", { maxNotes: 5 });
      expect(result.answerNotes).toHaveLength(5);
      expect(result.relatedPointers).toHaveLength(1);

      const annotated = {
        ...result,
        answerNotes: result.answerNotes.map((answer) => ({ ...answer, stale: true })),
        warning: "Index is stale: the note changed on disk but could not be re-indexed; run mdgraph_sync to refresh.",
      };
      expect(JSON.stringify(annotated, null, 2).length).toBeLessThanOrEqual(12000);
    } finally {
      close();
    }
  });

  it("shrinks the top answer as a last resort instead of exceeding the cap", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const hugeTitle = "T".repeat(7000);
      writeNote(vaultDir, "huge-title.md", `---\nid: huge-title\ntitle: ${hugeTitle}\n---\n${longBody("hugetitle", 220)}`);
      await syncVault(db.db, vaultDir);

      const result = exploreNotes(db.db, "hugetitle");

      expect(result.answerNotes).toHaveLength(1);
      expect(result.answerNotes[0].body.length).toBeGreaterThanOrEqual(1000);
      expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(12000);
    } finally {
      close();
    }
  });
});

describe("sliceBody", () => {
  it("returns the body untouched when it fits the cap", () => {
    const body = "# One\ntext\n## Two\nmore";
    const sliced = sliceBody(body, extractHeadings(body), body.length + 10);
    expect(sliced).toEqual({ body, truncated: false, omittedSections: [] });
  });

  it("keeps the 60% share when the cap lands inside a long line", () => {
    const lines = ["short 1", "short 2", "short 3", "short 4", "short 5", "short 6", "y".repeat(2000), "tail"];
    const body = lines.join("\n");
    const sliced = sliceBody(body, [], 1598);

    // The last newline is near offset 61, so the cut must not collapse to it.
    expect(sliced.truncated).toBe(true);
    expect(sliced.body.length).toBeGreaterThanOrEqual(0.6 * 1598);
    expect(sliced.body.length).toBeLessThanOrEqual(1598);
  });

  it("closes a fence left open by the cut and still keeps the 60% share", () => {
    const lines = ["# Fence", "intro", "```ts"];
    for (let i = 0; i < 40; i++) lines.push(`code line ${i} padding padding padding padding`);
    lines.push("```", "tail");
    const body = lines.join("\n");
    const sliced = sliceBody(body, extractHeadings(body), 1000);

    expect(sliced.truncated).toBe(true);
    expect(sliced.body.length).toBeGreaterThanOrEqual(600);
    expect(sliced.body.length).toBeLessThanOrEqual(1000);
    expect(sliced.body.endsWith("```")).toBe(true);
    expect((sliced.body.match(/```/g) ?? []).length).toBe(2);
  });

  it("recognizes ~~~ fences when closing a cut block", () => {
    const body = ["intro", "~~~", "code ".repeat(200), "~~~", "tail"].join("\n");
    const sliced = sliceBody(body, [], 400);

    expect(sliced.truncated).toBe(true);
    expect(sliced.body.length).toBeGreaterThanOrEqual(240);
    expect(sliced.body.length).toBeLessThanOrEqual(400);
    expect(sliced.body.endsWith("~~~")).toBe(true);
  });

  it("cuts at the last heading boundary that fits and reports dropped sections", () => {
    const body = ["# One", "alpha", "## Two", "beta", "## Three", "gamma", "## Four", "delta"].join("\n");
    const headings = extractHeadings(body);
    const thirdStart = body.indexOf("## Three");
    // 24 is 67% of the 36-character cap; the later newline cut at 33 is not taken.
    const sliced = sliceBody(body, headings, 36);

    expect(sliced.truncated).toBe(true);
    expect(sliced.body).toBe(body.slice(0, thirdStart));
    expect(sliced.body.endsWith("\n")).toBe(true);
    expect(sliced.omittedSections).toEqual(["Three", "Four"]);
  });

  it("falls back to a newline cut when the last heading boundary is far below the cap", () => {
    const lines = ["x".repeat(96), "## Early", "early body"];
    for (let i = 0; i < 150; i++) lines.push(`late line ${i} padding padding padding padding`);
    lines.push("## Later", "tail");
    const body = lines.join("\n");
    const earlyStart = body.indexOf("## Early");
    expect(earlyStart).toBeGreaterThan(90);
    expect(earlyStart).toBeLessThan(110);

    const sliced = sliceBody(body, extractHeadings(body), 6000);

    // Cutting at the early heading would return ~100 characters instead of ~6000.
    expect(sliced.truncated).toBe(true);
    expect(sliced.body.length).toBeGreaterThanOrEqual(3000);
    expect(sliced.body.length).toBeLessThanOrEqual(6000);
    expect(sliced.body.endsWith("\n")).toBe(true);
    expect(sliced.body).toContain("late line");
    expect(sliced.omittedSections).toContain("Later");
  });

  it("hard-cuts an oversized first section at the last newline that fits", () => {
    const body = Array.from({ length: 40 }, (_, i) => `line ${i} padding padding`).join("\n");
    const sliced = sliceBody(body, [], 100);

    expect(sliced.truncated).toBe(true);
    expect(sliced.body.length).toBeLessThanOrEqual(100);
    expect(sliced.body.endsWith("\n")).toBe(true);
    expect(sliced.omittedSections).toEqual([]);
    expect(body.startsWith(sliced.body)).toBe(true);
  });
});

describe("MCP_INSTRUCTIONS", () => {
  it("is non-empty, at most 20 lines, and covers the retrieval rules", () => {
    expect(MCP_INSTRUCTIONS.trim().length).toBeGreaterThan(0);
    expect(MCP_INSTRUCTIONS.split("\n").length).toBeLessThanOrEqual(20);
    for (const fragment of ["mdgraph_explore_notes", "mdgraph_search", "already served", "stale", "truncated"]) {
      expect(MCP_INSTRUCTIONS).toContain(fragment);
    }
  });

  it("reaches the client during initialize through the server factory", async () => {
    const server = createMcpServer();
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "mdgraph-instructions-test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      expect(client.getInstructions()).toBe(MCP_INSTRUCTIONS);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("ServedNotesStore LRU bound", () => {
  it("caps size at MAX_SERVED, evicting oldest and retaining newest", () => {
    const store = new ServedNotesStore();
    // Ensure we actually push past the configured bound.
    const total = EXPLORE_LIMITS.MAX_SERVED + 50;
    expect(total).toBeGreaterThan(EXPLORE_LIMITS.MAX_SERVED);

    for (let i = 0; i < total; i++) {
      store.set(`id-${i}`, `hash-${i}`, i);
    }

    // Size never exceeds the bound.
    expect((store as unknown as { records: Map<string, unknown> }).records.size).toBe(EXPLORE_LIMITS.MAX_SERVED);

    // Oldest inserted entries were evicted (LRU head), newest retained.
    expect(store.get("id-0")).toBeUndefined();
    expect(store.get(`id-${total - 1}`)).toBeDefined();

    // Re-serving an old-but-retained id moves it to the tail (survives next eviction).
    store.set("id-50", `hash-50`, 50);
    store.set(`id-${total}`, `hash-${total}`, total);
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
      registerExploreNotesTool(server, db.db, new ServedNotesStore(), vaultDir);

      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "mdgraph-test-client", version: "0.0.0" });
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      try {
        // Valid: bare { query } and { query, maxNotes } accepted.
        const okBare = await client.callTool({ name: "mdgraph_explore_notes", arguments: { query: "probe" } });
        expect(okBare.isError).toBeFalsy();
        expect(JSON.stringify(okBare.content)).toContain("probe");
        const payload = JSON.parse((okBare.content as Array<{ type: string; text: string }>)[0].text);
        // One body copy on the wire: no rendered markdown duplicate.
        expect("markdown" in payload).toBe(false);
        expect(payload.answerNotes[0].body).toContain("probe");

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

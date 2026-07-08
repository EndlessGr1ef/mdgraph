import { describe, it, expect } from "vitest";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getGraph, openDb, searchNotes, getNote, getStatus, markDeleted, CURRENT_SCHEMA_VERSION } from "../db.js";
import { syncVault, indexFile } from "../indexer.js";
import { resolveDbPath, toRelativePath } from "../paths.js";
import { updateNote } from "../mcp.js";
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
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-test-")));
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

function notePath(vaultDir: string, name: string): string {
  return toRelativePath(vaultDir, path.join(vaultDir, name));
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mdgraph core behaviors", () => {
  it("sets the current schema version on new databases", () => {
    const { db, close } = createTempVault();
    try {
      expect(db.db.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
    } finally {
      close();
    }
  });

  it("stamps a compatible pre-version database without rebuilding it", async () => {
    const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-test-")));
    const vaultDir = path.join(tmpDir, "vault");
    fs.mkdirSync(vaultDir, { recursive: true });
    try {
      writeNote(
        vaultDir,
        "existing.md",
        [
          "---",
          "id: existing",
          "title: Existing",
          "---",
          "Already indexed.",
        ].join("\n"),
      );

      const first = openDb(vaultDir);
      try {
        await syncVault(first.db, vaultDir);
        first.db.pragma("user_version = 0");
      } finally {
        first.close();
      }

      const second = openDb(vaultDir);
      try {
        expect(second.db.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
        expect(getNote(second.db, "existing")?.title).toBe("Existing");
      } finally {
        second.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("rebuilds a stale schema-version database because the index is disposable", async () => {
    const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-test-")));
    const vaultDir = path.join(tmpDir, "vault");
    fs.mkdirSync(path.join(vaultDir, ".mdgraph"), { recursive: true });
    try {
      const legacyDb = new Database(resolveDbPath(vaultDir));
      legacyDb.exec("CREATE TABLE notes (id TEXT PRIMARY KEY); INSERT INTO notes (id) VALUES ('stale');");
      legacyDb.close();

      writeNote(
        vaultDir,
        "kept.md",
        [
          "---",
          "id: kept",
          "title: Kept",
          "---",
          "Markdown remains the source of truth.",
        ].join("\n"),
      );

      const db = openDb(vaultDir);
      try {
        expect(db.db.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
        expect(getStatus(db.db).total_notes).toBe(0);

        const result = await syncVault(db.db, vaultDir);
        expect(result.indexed).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(getNote(db.db, "kept")?.title).toBe("Kept");
        expect(getNote(db.db, "stale")).toBeUndefined();
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -----------------------------------------------------------------------
  // 1. frontmatter id change → cleanup old, create new
  // -----------------------------------------------------------------------
  it("cleans up old note/FTS/tags/aliases/links when frontmatter id changes", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Initial note with id "alpha"
      writeNote(
        vaultDir,
        "test.md",
        [
          "---",
          "id: alpha",
          "title: Alpha Note",
          "tags: [tag-a, tag-b]",
          "aliases: [old-alias]",
          "---",
          "Body content. [[other-note]]",
        ].join("\n"),
      );

      await syncVault(db.db, vaultDir);

      // Verify "alpha" exists
      const alpha = getNote(db.db, "alpha");
      expect(alpha).toBeDefined();
      expect(alpha!.title).toBe("Alpha Note");

      // Tags verified via search (which returns tag arrays)
      const preResults = searchNotes(db.db, "Alpha");
      expect(preResults[0]?.tags).toEqual(["tag-a", "tag-b"]);

      // Change the same file to a different id "beta"
      writeNote(
        vaultDir,
        "test.md",
        [
          "---",
          "id: beta",
          "title: Beta Note",
          "tags: [tag-c]",
          "aliases: [new-alias]",
          "---",
          "New body. [[other-note]]",
        ].join("\n"),
      );

      await syncVault(db.db, vaultDir);

      // Old id "alpha" must be gone
      expect(getNote(db.db, "alpha")).toBeUndefined();

      // New id "beta" must exist
      const beta = getNote(db.db, "beta");
      expect(beta).toBeDefined();
      expect(beta!.title).toBe("Beta Note");

      // Tags verified via search
      const postResults = searchNotes(db.db, "New");
      const postBeta = postResults.find((r) => r.id === "beta");
      expect(postBeta).toBeDefined();
      expect(postBeta!.tags).toEqual(["tag-c"]);

      // id "alpha" should not appear in search
      const results = searchNotes(db.db, "Note");
      expect(results.some((r) => r.id === "beta")).toBe(true);
      expect(results.some((r) => r.id === "alpha")).toBe(false);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 2. duplicate note id → syncVault returns errors, good file still indexed
  // -----------------------------------------------------------------------
  it("does not silently overwrite on duplicate note id", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(
        vaultDir,
        "first.md",
        [
          "---",
          "id: dup-id",
          "title: First",
          "---",
          "Content A",
        ].join("\n"),
      );

      const initial = await syncVault(db.db, vaultDir);
      expect(initial.indexed).toBe(1);
      expect(initial.errors).toHaveLength(0);

      writeNote(
        vaultDir,
        "second.md",
        [
          "---",
          "id: dup-id",
          "title: Second",
          "---",
          "Content B",
        ].join("\n"),
      );

      const result = await syncVault(db.db, vaultDir);

      // syncVault should report the error
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe(notePath(vaultDir, "second.md"));
      expect(result.errors[0].error).toContain("Duplicate note id");

      // first.md / id "dup-id" should still be searchable
      const note = getNote(db.db, "dup-id");
      expect(note).toBeDefined();
      expect(note!.title).toBe("First");
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 3. deleted note does not pollute top tags / search
  // -----------------------------------------------------------------------
  it("does not leak deleted notes into top tags or search results", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(
        vaultDir,
        "keep.md",
        [
          "---",
          "id: keep",
          "title: Keep Me",
          "tags: [persistent]",
          "---",
          "I stay.",
        ].join("\n"),
      );
      writeNote(
        vaultDir,
        "gone.md",
        [
          "---",
          "id: gone",
          "title: Gone",
          "tags: [transient]",
          "aliases: [ghost]",
          "---",
          "I will be removed.",
        ].join("\n"),
      );

      await syncVault(db.db, vaultDir);

      // Delete gone.md from disk + mark deleted in DB
      fs.unlinkSync(path.join(vaultDir, "gone.md"));
      const goneRel = notePath(vaultDir, "gone.md");
      markDeleted(db.db, goneRel);

      // Re-sync to ensure consistent state (file no longer on disk)
      await syncVault(db.db, vaultDir);

      // Status should show only 1 non-deleted note
      const status = getStatus(db.db);
      expect(status.total_notes).toBe(1);
      expect(status.deleted_notes).toBe(1);

      // Top tags should NOT include "transient"
      const topTagNames = (status.top_tags as Array<{ tag: string }>).map((t) => t.tag);
      expect(topTagNames).toContain("persistent");
      expect(topTagNames).not.toContain("transient");

      // Search should not find "gone"
      const results = searchNotes(db.db, "removed");
      expect(results.length).toBe(0);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 4. single bad file does not block indexing of other files
  // -----------------------------------------------------------------------
  it("does not let one bad Markdown/frontmatter block other files", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(
        vaultDir,
        "good-a.md",
        [
          "---",
          "id: good-a",
          "title: Good A",
          "---",
          "Fine.",
        ].join("\n"),
      );

      // File with invalid YAML frontmatter → gray-matter throws
      writeNote(
        vaultDir,
        "bad.md",
        [
          "---",
          "invalid yaml: [unclosed",
          "---",
          "Broken.",
        ].join("\n"),
      );

      writeNote(
        vaultDir,
        "good-b.md",
        [
          "---",
          "id: good-b",
          "title: Good B",
          "---",
          "Also fine.",
        ].join("\n"),
      );

      const result = await syncVault(db.db, vaultDir);

      // good-a and good-b indexed, bad.md failed
      expect(result.indexed).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe(notePath(vaultDir, "bad.md"));

      // Both good files are indexed (verify via status)
      const status = getStatus(db.db);
      expect(status.total_notes).toBe(2);

      // Both good files are individually searchable
      expect(searchNotes(db.db, "Fine").some((r) => r.id === "good-a")).toBe(true);
      expect(searchNotes(db.db, "Also").some((r) => r.id === "good-b")).toBe(true);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 5. MCP create_note does not overwrite existing files
  //
  //    Directly testing the MCP handler requires starting stdio transport, so
  //    this covers the three critical lower-level behaviors instead:
  //      a) fs.writeFile with flag "wx" rejects on existing file
  //      b) fs.writeFile with flag "wx" succeeds on new file
  //      c) indexFile correctly indexes the newly created file
  //    assertInsideVault is better covered separately with path-focused tests.
  // -----------------------------------------------------------------------
  it("mcp mdgraph_create_note underlying logic: wx flag prevents overwrite", async () => {
    const { vaultDir, close } = createTempVault();
    try {
      const filePath = path.join(vaultDir, "existing.md");

      // a) wx fails when file already exists
      await fsp.writeFile(filePath, "content", "utf-8");
      await expect(
        fsp.writeFile(filePath, "new content", { encoding: "utf8", flag: "wx" }),
      ).rejects.toThrow(/EEXIST|file already exists/i);
    } finally {
      close();
    }
  });

  it("mcp mdgraph_create_note underlying logic: wx + indexFile for fresh file", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const newFilePath = path.join(vaultDir, "fresh.md");

      // b) wx succeeds for new file
      await fsp.writeFile(newFilePath, '---\nid: fresh\n---\nHello', { encoding: "utf8", flag: "wx" });

      // c) indexFile correctly indexes it
      await indexFile(db.db, vaultDir, newFilePath);
      const note = getNote(db.db, "fresh");
      expect(note).toBeDefined();
      expect(note!.title).toBe("fresh");
    } finally {
      close();
    }
  });

  it("mcp mdgraph_update_note updates the Markdown source and refreshed index", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const filePath = writeNote(
        vaultDir,
        "update-me.md",
        [
          "---",
          "id: update-me",
          "title: Old Title",
          "status: active",
          "tags: [old]",
          "aliases: [legacy]",
          "---",
          "Old body.",
        ].join("\n"),
      );
      await syncVault(db.db, vaultDir);

      const result = await updateNote(db.db, vaultDir, {
        id: "update-me",
        title: "New Title",
        content: "Replacement body with [[target]].",
        status: "archived",
        tags: ["new"],
        aliases: ["fresh"],
      });

      expect(result).toEqual({ success: true, id: "update-me", path: notePath(vaultDir, "update-me.md") });

      const raw = await fsp.readFile(filePath, "utf8");
      expect(raw).toContain("id: update-me");
      expect(raw).toContain("title: New Title");
      expect(raw).toContain("Replacement body with [[target]].");

      const note = getNote(db.db, "update-me");
      expect(note).toBeDefined();
      expect(note!.title).toBe("New Title");
      expect(note!.status).toBe("archived");
      expect(note!.body).toBe("Replacement body with [[target]].\n");

      const results = searchNotes(db.db, "Replacement", { tag: "new", status: "archived" });
      expect(results.some((row) => row.id === "update-me")).toBe(true);
      expect(searchNotes(db.db, "Old body")).toHaveLength(0);
    } finally {
      close();
    }
  });

  it("mcp mdgraph_update_note reports a missing Markdown source file", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      const filePath = writeNote(
        vaultDir,
        "missing.md",
        [
          "---",
          "id: missing",
          "title: Missing",
          "---",
          "Soon gone.",
        ].join("\n"),
      );
      await syncVault(db.db, vaultDir);
      fs.unlinkSync(filePath);

      await expect(updateNote(db.db, vaultDir, { id: "missing", content: "New body." })).rejects.toThrow(
        "Note file not found on disk: missing.md",
      );
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 6. watcher in non-vault cwd can still index new notes
  //
  //    Simulates the CLI running from outside the vault while chokidar watches
  //    the vault root and reports a file add event.
  // -----------------------------------------------------------------------
  it("watcher indexes a new note from a non-vault cwd", async () => {
    const { tmpDir, vaultDir, db, close } = createTempVault();
    const origCwd = process.cwd();
    const outsideDir = path.join(tmpDir, "outside");
    fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    process.chdir(outsideDir);

    const watcher = watchVault(db.db, vaultDir);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for watcher ready")), 5_000);
        watcher.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
        watcher.once("error", reject);
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      writeNote(
        vaultDir,
        "sub/deep.md",
        [
          "---",
          "id: deep-note",
          "title: Deep",
          "tags: [nested]",
          "---",
          "Found even from outside cwd.",
        ].join("\n"),
      );

      const note = await waitFor(() => getNote(db.db, "deep-note"), 10_000);
      expect(note.path).toBe(notePath(vaultDir, "sub/deep.md"));
      expect(note.path).not.toContain("..");

      const results = searchNotes(db.db, "outside", { tag: "nested" });
      expect(results.some((r) => r.id === "deep-note")).toBe(true);
    } finally {
      await watcher.close();
      process.chdir(origCwd);
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 7. Ignore rules: _template.md is ignored by default
  // -----------------------------------------------------------------------
  it("ignores _template.md by default but indexes normal notes", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "note.md", "---\nid: note\n---\nRegular note.");
      writeNote(vaultDir, "_template.md", "---\nid: tpl\n---\nTemplate.");
      fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
      writeNote(vaultDir, "sub/_template.md", "---\nid: sub-tpl\n---\nSub template.");

      const result = await syncVault(db.db, vaultDir);
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);

      expect(getNote(db.db, "note")).toBeDefined();
      expect(getNote(db.db, "tpl")).toBeUndefined();
      expect(getNote(db.db, "sub-tpl")).toBeUndefined();
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 8. .mdgraphignore custom exclude rules
  // -----------------------------------------------------------------------
  it("respects .mdgraphignore custom glob patterns", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Create notes
      writeNote(vaultDir, "keep.md", "---\nid: keep\n---\nKeep me.");
      writeNote(vaultDir, "ignored.md", "---\nid: ignored\n---\nIgnored file.");
      fs.mkdirSync(path.join(vaultDir, "drafts"), { recursive: true });
      writeNote(vaultDir, "drafts/wip.md", "---\nid: wip\n---\nDraft note.");

      // Write .mdgraphignore
      fs.writeFileSync(path.join(vaultDir, ".mdgraphignore"), "ignored.md\ndrafts/**\n", "utf-8");

      const result = await syncVault(db.db, vaultDir);
      // keep.md is the only non-ignored file
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);

      expect(getNote(db.db, "keep")).toBeDefined();
      expect(getNote(db.db, "ignored")).toBeUndefined();
      expect(getNote(db.db, "wip")).toBeUndefined();
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 9. Previously indexed file becomes ignored → removed on next sync
  // -----------------------------------------------------------------------
  it("removes previously indexed files when they become ignored by .mdgraphignore", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Index the file first
      writeNote(vaultDir, "important.md", "---\nid: important\n---\nImportant note.");
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "important")).toBeDefined();

      // Now ignore it via .mdgraphignore
      fs.writeFileSync(path.join(vaultDir, ".mdgraphignore"), "important.md\n", "utf-8");
      const result = await syncVault(db.db, vaultDir);

      // Should be removed from search/status
      expect(result.removed).toBe(1);
      expect(result.indexed).toBe(0);

      // getNote returns even deleted notes; verify status changed
      const note = getNote(db.db, "important");
      expect(note).toBeDefined();
      expect(note!.status).toBe("deleted");

      // Search should not return it
      const searchResults = searchNotes(db.db, "Important");
      expect(searchResults.some((r) => r.id === "important")).toBe(false);

      // Status reflects the deletion
      const status = getStatus(db.db);
      expect(status.total_notes).toBe(0);
      expect(status.deleted_notes).toBe(1);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 10. Watcher respects ignore rules (template + .mdgraphignore patterns)
  // -----------------------------------------------------------------------
  it("watcher does not index _template.md or .mdgraphignore-ignored files", async () => {
    const { tmpDir, vaultDir, db, close } = createTempVault();
    const origCwd = process.cwd();
    process.chdir(tmpDir);

    // Write .mdgraphignore BEFORE starting the watcher
    fs.writeFileSync(path.join(vaultDir, ".mdgraphignore"), "ignored-by-watch.md\n", "utf-8");

    const watcher = watchVault(db.db, vaultDir);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for watcher ready")), 5_000);
        watcher.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
        watcher.once("error", reject);
      });

      // Create _template.md — should NOT be indexed
      writeNote(vaultDir, "_template.md", "---\nid: tpl-watch\n---\nWatcher template.");
      await new Promise((r) => setTimeout(r, 600));
      expect(getNote(db.db, "tpl-watch")).toBeUndefined();

      // Create a file matching .mdgraphignore — should NOT be indexed
      writeNote(
        vaultDir,
        "ignored-by-watch.md",
        "---\nid: ignored-watch\n---\nIgnored by watcher.",
      );
      await new Promise((r) => setTimeout(r, 600));
      expect(getNote(db.db, "ignored-watch")).toBeUndefined();

      // Create a regular note — should be indexed
      writeNote(vaultDir, "watcher-note.md", "---\nid: watcher-note\n---\nWatcher note.");
      const note = await waitFor(() => getNote(db.db, "watcher-note"));
      expect(note).toBeDefined();
      expect(note!.title).toBe("watcher-note");
    } finally {
      await watcher.close();
      process.chdir(origCwd);
      close();
    }
  });

  it("extracts nested Markdown headings into getNote outline", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(
        vaultDir,
        "outline.md",
        [
          "---",
          "id: outline-note",
          "title: Outline Note",
          "---",
          "# Overview",
          "Intro.",
          "## Research",
          "Context.",
          "### Method",
          "Details.",
          "## Research",
          "Duplicate heading.",
        ].join("\n"),
      );

      await syncVault(db.db, vaultDir);
      const note = getNote(db.db, "outline-note");

      expect(note?.outline).toEqual([
        { level: 1, text: "Overview", slug: "overview", line: 1, position: 0, path: ["Overview"] },
        { level: 2, text: "Research", slug: "research", line: 3, position: 18, path: ["Overview", "Research"] },
        { level: 3, text: "Method", slug: "method", line: 5, position: 39, path: ["Overview", "Research", "Method"] },
        { level: 2, text: "Research", slug: "research-2", line: 7, position: 59, path: ["Overview", "Research"] },
      ]);
    } finally {
      close();
    }
  });

  it("updates heading outline after re-sync", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "changing.md", "---\nid: changing\n---\n# Old\nOld body.");
      await syncVault(db.db, vaultDir);
      expect(getNote(db.db, "changing")?.outline.map((heading) => heading.text)).toEqual(["Old"]);

      writeNote(vaultDir, "changing.md", "---\nid: changing\n---\n# New\n## Details\nNew body.");
      await syncVault(db.db, vaultDir);

      expect(getNote(db.db, "changing")?.outline.map((heading) => heading.path)).toEqual([
        ["New"],
        ["New", "Details"],
      ]);
    } finally {
      close();
    }
  });

  it("adds note outline to search results", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(
        vaultDir,
        "search-section.md",
        [
          "---",
          "id: search-section",
          "title: Search Section",
          "---",
          "# Root",
          "Intro text.",
          "## Research",
          "General context.",
          "### Method",
          "The needlephrase belongs to this method section.",
        ].join("\n"),
      );

      await syncVault(db.db, vaultDir);
      const result = searchNotes(db.db, "needlephrase")[0];

      expect(result.id).toBe("search-section");
      expect(result.outline.map((heading) => heading.path)).toEqual([
        ["Root"],
        ["Root", "Research"],
        ["Root", "Research", "Method"],
      ]);
    } finally {
      close();
    }
  });

  it("returns empty outline when a note has no headings", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "plain.md", "---\nid: plain\n---\nPlain note with uniqueword.");
      await syncVault(db.db, vaultDir);

      expect(getNote(db.db, "plain")?.outline).toEqual([]);
      expect(searchNotes(db.db, "uniqueword")[0]?.outline).toEqual([]);
    } finally {
      close();
    }
  });

  it("matches by filename even when a frontmatter title is set", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Filename stem is "filename-matchable"; frontmatter title differs,
      // so without indexing the path the note would be unsearchable by name.
      writeNote(
        vaultDir,
        "filename-matchable.md",
        [
          "---",
          "id: filename-matchable",
          "title: Display Title",
          "---",
          "Body text contains neither the filename nor the title.",
        ].join("\n"),
      );
      await syncVault(db.db, vaultDir);

      const results = searchNotes(db.db, "filename-matchable");
      expect(results.some((r) => r.id === "filename-matchable")).toBe(true);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // Graph: getNote includes outlinks, backlinks, broken, ambiguous
  // -----------------------------------------------------------------------
  it("getNote includes resolved outlinks", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "alpha.md", "---\nid: alpha\ntitle: Alpha\n---\nLink to [[beta]].");
      writeNote(vaultDir, "beta.md", "---\nid: beta\ntitle: Beta\n---\nBeta body.");
      await syncVault(db.db, vaultDir);

      const note = getNote(db.db, "alpha");
      expect(note?.graph).toBeDefined();
      expect(note!.graph!.outlinks).toHaveLength(1);
      expect(note!.graph!.outlinks[0]).toMatchObject({ rawTarget: "beta", resolvedId: "beta" });
      expect(note!.graph!.backlinks).toHaveLength(0);
      expect(note!.graph!.brokenLinks).toHaveLength(0);
      expect(note!.graph!.ambiguousLinks).toHaveLength(0);
    } finally {
      close();
    }
  });

  it("getNote includes backlinks", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "source.md", "---\nid: source\ntitle: Source\n---\n[[target]]");
      writeNote(vaultDir, "target.md", "---\nid: target\ntitle: Target\n---\nTarget body.");
      await syncVault(db.db, vaultDir);

      const note = getNote(db.db, "target");
      expect(note?.graph).toBeDefined();
      expect(note!.graph!.backlinks).toHaveLength(1);
      expect(note!.graph!.backlinks[0]).toMatchObject({ resolvedId: "source" });
    } finally {
      close();
    }
  });

  it("getNote reports broken links", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "broken.md", "---\nid: broken\ntitle: Broken\n---\nLink to [[nonexistent]].");
      await syncVault(db.db, vaultDir);

      const note = getNote(db.db, "broken");
      expect(note!.graph!.brokenLinks).toContain("nonexistent");
      expect(note!.graph!.outlinks).toHaveLength(0);
    } finally {
      close();
    }
  });

  it("getNote reports ambiguous links via title match", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "first.md", "---\nid: first\ntitle: Same Title\n---\nFirst.");
      writeNote(vaultDir, "second.md", "---\nid: second\ntitle: Same Title\n---\nSecond.");
      writeNote(vaultDir, "linker.md", "---\nid: linker\ntitle: Linker\n---\nLink to [[Same Title]].");
      await syncVault(db.db, vaultDir);

      const note = getNote(db.db, "linker");
      expect(note!.graph!.ambiguousLinks).toHaveLength(1);
      expect(note!.graph!.ambiguousLinks[0].rawTarget).toBe("Same Title");
      expect(note!.graph!.ambiguousLinks[0].candidates).toHaveLength(2);
      expect(note!.graph!.outlinks).toHaveLength(0);
      expect(note!.graph!.brokenLinks).toHaveLength(0);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // Graph: search results include compact summary
  // -----------------------------------------------------------------------
  it("search result includes graph summary with counts and preview", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "linked.md", "---\nid: linked\ntitle: Linked\n---\nLinked body. [[other]]");
      writeNote(vaultDir, "other.md", "---\nid: other\ntitle: Other\n---\nOther note.");
      await syncVault(db.db, vaultDir);

      const results = searchNotes(db.db, "Linked");
      expect(results).toHaveLength(1);
      expect(results[0].graph).toBeDefined();
      expect(results[0].graph!.outlinks).toBe(1);
      expect(results[0].graph!.backlinks).toBe(0);
      expect(results[0].graph!.broken).toBe(0);
      expect(results[0].graph!.outlinks_preview).toHaveLength(1);
      expect(results[0].graph!.outlinks_preview[0].id).toBe("other");
      expect(results[0].graph!.outlinks_preview[0].title).toBe("Other");
    } finally {
      close();
    }
  });

  it("search graph summary tracks broken links", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "has-broken.md", "---\nid: has-broken\ntitle: Has Broken\n---\nBody. [[nowhere]]");
      await syncVault(db.db, vaultDir);

      const results = searchNotes(db.db, "Has Broken");
      expect(results[0].graph!.broken).toBe(1);
      expect(results[0].graph!.outlinks_preview).toHaveLength(0);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // Graph: dedicated getGraph respects depth/direction/maxNodes
  // -----------------------------------------------------------------------
  it("dedicated graph respects depth parameter", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "root.md", "---\nid: root\ntitle: Root\n---\n[[mid]]");
      writeNote(vaultDir, "mid.md", "---\nid: mid\ntitle: Mid\n---\n[[leaf]]");
      writeNote(vaultDir, "leaf.md", "---\nid: leaf\ntitle: Leaf\n---\nLeaf body.");
      await syncVault(db.db, vaultDir);

      // depth=1: root → mid
      const d1 = getGraph(db.db, "root", { depth: 1 });
      expect(d1!.nodes.map((n) => n.id).sort()).toEqual(["mid", "root"]);

      // depth=2: root → mid → leaf
      const d2 = getGraph(db.db, "root", { depth: 2 });
      expect(d2!.nodes.map((n) => n.id).sort()).toEqual(["leaf", "mid", "root"]);
    } finally {
      close();
    }
  });

  it("dedicated graph respects maxNodes parameter", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "hub.md", "---\nid: hub\ntitle: Hub\n---\n[[a]] [[b]] [[c]] [[d]]");
      writeNote(vaultDir, "a.md", "---\nid: a\ntitle: A\n---\nA.");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: B\n---\nB.");
      writeNote(vaultDir, "c.md", "---\nid: c\ntitle: C\n---\nC.");
      writeNote(vaultDir, "d.md", "---\nid: d\ntitle: D\n---\nD.");
      await syncVault(db.db, vaultDir);

      const limited = getGraph(db.db, "hub", { maxNodes: 3 });
      expect(limited!.nodes.length).toBeLessThanOrEqual(3);
      // hub must be included
      expect(limited!.nodes.some((n) => n.id === "hub")).toBe(true);
    } finally {
      close();
    }
  });

  it("dedicated graph respects direction parameter", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "alpha.md", "---\nid: alpha\ntitle: Alpha\n---\n[[beta]]");
      writeNote(vaultDir, "beta.md", "---\nid: beta\ntitle: Beta\n---\nBeta body.");
      await syncVault(db.db, vaultDir);

      // "back" from beta should find alpha
      const back = getGraph(db.db, "beta", { direction: "back" });
      expect(back!.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta"]);

      // "out" from beta should only contain beta (no outlinks)
      const out = getGraph(db.db, "beta", { direction: "out" });
      expect(out!.nodes).toHaveLength(1);
      expect(out!.nodes[0].id).toBe("beta");
    } finally {
      close();
    }
  });

  it("dedicated graph returns undefined for missing note", async () => {
    const { db, close } = createTempVault();
    try {
      expect(getGraph(db.db, "does-not-exist")).toBeUndefined();
    } finally {
      close();
    }
  });

  it("dedicated graph includes edges in result", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", "---\nid: a\ntitle: A\n---\n[[b]]");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: B\n---\n[[c]]");
      writeNote(vaultDir, "c.md", "---\nid: c\ntitle: C\n---\nC body.");
      await syncVault(db.db, vaultDir);

      const g = getGraph(db.db, "a", { depth: 2 });
      expect(g!.edges).toHaveLength(2);
      expect(g!.edges[0]).toEqual({ source: "a", target: "b" });
      expect(g!.edges[1]).toEqual({ source: "b", target: "c" });
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 11. Ambiguous backlinks are NOT counted
  // -----------------------------------------------------------------------
  it("does not count ambiguous links as backlinks", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Two notes share the same title
      writeNote(vaultDir, "a.md", "---\nid: a\ntitle: Shared\n---\nNote A.");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: Shared\n---\nNote B.");
      // A third note links to [[Shared]] (ambiguous — two candidates)
      writeNote(vaultDir, "src.md", "---\nid: src\n---\nLook at [[Shared]].");
      await syncVault(db.db, vaultDir);

      // Neither A nor B should report src as a backlink
      const graphA = getNote(db.db, "a")!.graph!;
      expect(graphA.backlinks).toHaveLength(0);
      expect(graphA.totalBacklinks).toBe(0);

      const graphB = getNote(db.db, "b")!.graph!;
      expect(graphB.backlinks).toHaveLength(0);
      expect(graphB.totalBacklinks).toBe(0);

      // The ambiguous link from src should still be reported as ambiguous
      const graphSrc = getNote(db.db, "src")!.graph!;
      expect(graphSrc.ambiguousLinks.length).toBeGreaterThanOrEqual(1);
    } finally {
      close();
    }
  });

  it("does count unique backlinks when resolution is unambiguous via id", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "source.md", "---\nid: source\n---\nSee [[target-by-id]].");
      writeNote(vaultDir, "target.md", "---\nid: target-by-id\ntitle: Target\n---\nBody.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "target-by-id")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0]).toMatchObject({ rawTarget: "target-by-id", resolvedId: "source" });
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  it("does count a backlink when the source uses the target's alias", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "aliased.md", "---\nid: aliased\ntitle: Real Name\naliases: [nickname]\n---\nBody.");
      writeNote(vaultDir, "linker.md", "---\nid: linker\n---\nRefer to [[nickname]].");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "aliased")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0].rawTarget).toBe("nickname");
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 13. Unique title backlinks
  // -----------------------------------------------------------------------
  it("counts a backlink when the source uses a unique title", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "source.md", "---\nid: source\n---\nSee [[Unique Title]].");
      writeNote(vaultDir, "target.md", "---\nid: target\ntitle: Unique Title\n---\nBody.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "target")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0]).toMatchObject({ rawTarget: "Unique Title", resolvedId: "source" });
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  it("does not count a backlink for ambiguous title (no target gets the backlink)", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "first.md", "---\nid: first\ntitle: Shared\n---\nFirst.");
      writeNote(vaultDir, "second.md", "---\nid: second\ntitle: Shared\n---\nSecond.");
      writeNote(vaultDir, "source.md", "---\nid: source\n---\nLink [[Shared]].");
      await syncVault(db.db, vaultDir);

      // Neither candidate gets a backlink
      const graphFirst = getNote(db.db, "first")!.graph!;
      expect(graphFirst.backlinks).toHaveLength(0);
      expect(graphFirst.totalBacklinks).toBe(0);

      const graphSecond = getNote(db.db, "second")!.graph!;
      expect(graphSecond.backlinks).toHaveLength(0);
      expect(graphSecond.totalBacklinks).toBe(0);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 14. Relative Markdown backlinks
  // -----------------------------------------------------------------------
  it("counts relative markdown link ./b.md as a backlink", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", "---\nid: a\n---\nSee [B](./b.md).");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: Bee\n---\nB body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "b")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0]).toMatchObject({ rawTarget: "./b.md", resolvedId: "a" });
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  it("counts sibling relative markdown link b.md from subdirectory as a backlink", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
      writeNote(vaultDir, "sub/a.md", "---\nid: a\n---\nSee [Sib](b.md).");
      writeNote(vaultDir, "sub/b.md", "---\nid: b\ntitle: Sib\n---\nSib body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "b")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0]).toMatchObject({ rawTarget: "b.md", resolvedId: "a" });
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  it("counts parent-relative markdown link ../b.md as a backlink", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
      writeNote(vaultDir, "sub/a.md", "---\nid: a\n---\nSee [Up](../b.md).");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: Bee\n---\nB body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "b")!.graph!;
      expect(graph.backlinks).toHaveLength(1);
      expect(graph.backlinks[0]).toMatchObject({ rawTarget: "../b.md", resolvedId: "a" });
      expect(graph.totalBacklinks).toBe(1);
    } finally {
      close();
    }
  });

  it("getGraph direction=back traverses a relative markdown backlink", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", "---\nid: a\n---\nSee [B](./b.md).");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: Bee\n---\nB body.");
      await syncVault(db.db, vaultDir);

      // "back" from b should find a
      const back = getGraph(db.db, "b", { direction: "back" });
      expect(back).toBeDefined();
      expect(back!.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
      expect(back!.edges).toHaveLength(1);
      expect(back!.edges[0]).toEqual({ source: "a", target: "b" });
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 15. Relative markdown link resolution (outlinks)
  // -----------------------------------------------------------------------
  it("resolves relative markdown link ./b.md from same directory", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "a.md", "---\nid: a\n---\nSee [B](./b.md).");
      writeNote(vaultDir, "b.md", "---\nid: b\ntitle: Bee\n---\nB body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "a")!.graph!;
      expect(graph.outlinks).toHaveLength(1);
      expect(graph.outlinks[0]).toMatchObject({ rawTarget: "./b.md", resolvedId: "b" });
      expect(graph.totalOutlinks).toBe(1);
    } finally {
      close();
    }
  });

  it("resolves relative markdown link b.md from subdirectory (sibling)", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
      writeNote(vaultDir, "sub/a.md", "---\nid: a\n---\nSee [Sib](b.md).");
      writeNote(vaultDir, "sub/b.md", "---\nid: b\ntitle: Sib\n---\nSib body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "a")!.graph!;
      expect(graph.outlinks).toHaveLength(1);
      expect(graph.outlinks[0]).toMatchObject({ rawTarget: "b.md", resolvedId: "b" });
      expect(graph.totalOutlinks).toBe(1);
    } finally {
      close();
    }
  });

  it("resolves relative markdown link ../b.md to parent directory", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
      writeNote(vaultDir, "sub/a.md", "---\nid: a\n---\nSee [Up](../parent.md).");
      writeNote(vaultDir, "parent.md", "---\nid: p\ntitle: Parent\n---\nParent body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "a")!.graph!;
      expect(graph.outlinks).toHaveLength(1);
      expect(graph.outlinks[0]).toMatchObject({ rawTarget: "../parent.md", resolvedId: "p" });
      expect(graph.totalOutlinks).toBe(1);
    } finally {
      close();
    }
  });

  it("resolves a wiki link with relative path prefix via source-aware normalization", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub", "deep"), { recursive: true });
      writeNote(vaultDir, "sub/deep/a.md", "---\nid: a\n---\nSee [[../../other]].");
      writeNote(vaultDir, "other.md", "---\nid: other\ntitle: Other\n---\nOther body.");
      await syncVault(db.db, vaultDir);

      // "[[../../other]]" starts with "../" so resolveLinkTarget normalizes
      // it relative to "sub/deep/a.md" → "other", which resolves by id.
      const graph = getNote(db.db, "a")!.graph!;
      expect(graph.outlinks).toHaveLength(1);
      expect(graph.outlinks[0]).toMatchObject({ rawTarget: "../../other", resolvedId: "other" });
      expect(graph.totalOutlinks).toBe(1);
    } finally {
      close();
    }
  });

  it("resolves markdown link with relative path from subdir that ends in .md", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      fs.mkdirSync(path.join(vaultDir, "sub", "deep"), { recursive: true });
      writeNote(vaultDir, "sub/deep/a.md", "---\nid: a\n---\nSee [Other](../../other.md).");
      writeNote(vaultDir, "other.md", "---\nid: other\ntitle: Other\n---\nOther body.");
      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "a")!.graph!;
      expect(graph.outlinks).toHaveLength(1);
      expect(graph.outlinks[0]).toMatchObject({ resolvedId: "other" });
      expect(graph.totalOutlinks).toBe(1);
    } finally {
      close();
    }
  });

  // -----------------------------------------------------------------------
  // 16. getNote graph limit / context size
  // -----------------------------------------------------------------------
  it("getNote graph applies default limit to arrays and reports totals", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      // Create a hub with many outlinks and many backlinks
      writeNote(vaultDir, "hub.md", "---\nid: hub\ntitle: Hub\n---\n" +
        Array.from({ length: 30 }, (_, i) => `[[target-${i}]]`).join(" ")
      );
      for (let i = 0; i < 30; i++) {
        writeNote(vaultDir, `t${i}.md`, `---\nid: target-${i}\n---\nTarget ${i}.\n`);
      }

      // Also create 30 backlinks → each of these links to hub
      writeNote(vaultDir, "backlink-source-0.md", "---\nid: bs0\n---\n[[hub]]");
      writeNote(vaultDir, "backlink-source-1.md", "---\nid: bs1\n---\n[[hub]]");

      await syncVault(db.db, vaultDir);

      const graph = getNote(db.db, "hub")!.graph!;

      // Default limit = 20 per category
      expect(graph.outlinks.length).toBeLessThanOrEqual(20);
      expect(graph.totalOutlinks).toBe(30);

      // Backlinks: 2 source notes link to hub
      expect(graph.backlinks.length).toBe(2);
      expect(graph.totalBacklinks).toBe(2);

      expect(graph.totalBroken).toBe(0);
      expect(graph.totalAmbiguous).toBe(0);
    } finally {
      close();
    }
  });

  it("getNote respects explicit graphLimit", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "hub.md", "---\nid: hub\n---\n" +
        Array.from({ length: 10 }, (_, i) => `[[n-${i}]]`).join(" ")
      );
      for (let i = 0; i < 10; i++) {
        writeNote(vaultDir, `n${i}.md`, `---\nid: n-${i}\n---\nNote ${i}.`);
      }
      await syncVault(db.db, vaultDir);

      // Explicit small limit
      const graph = getNote(db.db, "hub", { graphLimit: 3 })!.graph!;
      expect(graph.outlinks.length).toBe(3);
      expect(graph.totalOutlinks).toBe(10);
    } finally {
      close();
    }
  });

  it("search graph summary remains compact with preview size 3", async () => {
    const { vaultDir, db, close } = createTempVault();
    try {
      writeNote(vaultDir, "spoke.md", "---\nid: spoke\ntitle: Spoke\n---\n" +
        Array.from({ length: 10 }, (_, i) => `[[s-${i}]]`).join(" ")
      );
      for (let i = 0; i < 10; i++) {
        writeNote(vaultDir, `s${i}.md`, `---\nid: s-${i}\n---\nS ${i}.`);
      }
      await syncVault(db.db, vaultDir);

      const results = searchNotes(db.db, "Spoke");
      expect(results).toHaveLength(1);
      expect(results[0].graph!.outlinks).toBe(10);
      expect(results[0].graph!.outlinks_preview).toHaveLength(3); // still compact
    } finally {
      close();
    }
  });
});

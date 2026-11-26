import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getNote, getGraph, searchNotes } from "../db.js";
import { syncVault, syncChangedFiles, isVaultDocumentPath } from "../indexer.js";
import { parseHtmlPage } from "../html.js";
import { updateNote } from "../mcp.js";

interface TempVault {
  tmpDir: string;
  vaultDir: string;
  db: ReturnType<typeof openDb>;
  close: () => void;
}

const vaults: TempVault[] = [];

function createTempVault(): TempVault {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mdgraph-html-test-")));
  const vaultDir = path.join(tmpDir, "vault");
  fs.mkdirSync(vaultDir, { recursive: true });
  const vault = { tmpDir, vaultDir, db: openDb(vaultDir), close: () => {} };
  vault.close = () => {
    vault.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };
  vaults.push(vault);
  return vault;
}

function writeFile(vaultDir: string, name: string, content: string): void {
  const filePath = path.join(vaultDir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

afterEach(() => {
  while (vaults.length) vaults.pop()?.close();
});

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe("parseHtmlPage", () => {
  it("prefers <title> and falls back to the first h1, then the filename", () => {
    const withTitle = parseHtmlPage("a.html", "<html><head><title>Real Title</title></head><body></body></html>");
    const withH1 = parseHtmlPage("b.html", "<html><body><h1>Heading Title</h1></body></html>");
    const bare = parseHtmlPage("docs/c.html", "<html><body><p>plain</p></body></html>");

    expect(withTitle.title).toBe("Real Title");
    expect(withH1.title).toBe("Heading Title");
    expect(bare.title).toBe("c");
  });

  it("keeps visible text but drops script, style, svg, nav, footer and diagram sources", () => {
    const note = parseHtmlPage(
      "report.html",
      `<html><body>
        <nav>NAVIGATION_CHROME</nav>
        <p>Visible body text</p>
        <pre class="mermaid">graph LR; A--&gt;B</pre>
        <script>var leak = "SCRIPT_LEAK";</script>
        <style>.x { color: STYLE_LEAK }</style>
        <svg><text>SVG_LEAK</text></svg>
        <footer>FOOTER_CHROME</footer>
      </body></html>`,
    );

    expect(note.body).toContain("Visible body text");
    for (const hidden of ["NAVIGATION_CHROME", "SCRIPT_LEAK", "STYLE_LEAK", "SVG_LEAK", "FOOTER_CHROME", "graph LR"]) {
      expect(note.body).not.toContain(hidden);
    }
  });

  it("extracts headings using the document's own id as the slug", () => {
    const note = parseHtmlPage("h.html", '<html><body><h1 id="top">Top</h1><h2>Sub One</h2></body></html>');

    expect(note.headings.map((heading) => [heading.level, heading.text, heading.slug])).toEqual([
      [1, "Top", "top"],
      [2, "Sub One", "sub-one"],
    ]);
    expect(note.headings[1].path).toEqual(["Top", "Sub One"]);
  });

  it("keeps vault-local links and rejects external, anchor and mailto targets", () => {
    const note = parseHtmlPage(
      "p.html",
      `<html><body>
        <a href="other.html">a</a>
        <a href="./nested/b.htm#frag">b</a>
        <a href="https://example.com/x">external</a>
        <a href="//cdn.example.com/y">protocol relative</a>
        <a href="mailto:a@b.c">mail</a>
        <a href="#local">anchor</a>
      </body></html>`,
    );

    expect(note.links).toEqual(["other.html", "./nested/b.htm"]);
    expect(note.type).toBe("page");
  });

  it("derives ids from the full path so a page and a note never collide", () => {
    const page = parseHtmlPage("docs/report.html", "<html><body></body></html>");
    const note = parseHtmlPage("docs/report.md", "<html><body></body></html>");

    expect(page.id).toBe("docs_report_html");
    expect(note.id).toBe("docs_report_md");
    expect(page.id).not.toBe(note.id);
  });
});

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

describe("HTML indexing", () => {
  it("treats .html and .htm as indexable vault documents", () => {
    expect(isVaultDocumentPath("a.html")).toBe(true);
    expect(isVaultDocumentPath("a.HTM")).toBe(true);
    expect(isVaultDocumentPath("a.md")).toBe(true);
    expect(isVaultDocumentPath("a.txt")).toBe(false);
    expect(isVaultDocumentPath("a.js")).toBe(false);
  });

  it("indexes HTML pages on a full sync so they are searchable", async () => {
    const vault = createTempVault();
    writeFile(vault.vaultDir, "report.html", "<html><head><title>Quarterly Report</title></head><body><p>uniquewordcontent</p></body></html>");
    writeFile(vault.vaultDir, "note.md", "---\ntitle: Note\n---\nbody\n");

    const result = await syncVault(vault.db.db, vault.vaultDir);
    expect(result.indexed).toBe(2);

    const hits = searchNotes(vault.db.db, "uniquewordcontent");
    expect(hits.map((hit) => hit.path)).toContain("report.html");
  });

  it("removes an HTML page from the index when the file is deleted", async () => {
    const vault = createTempVault();
    writeFile(vault.vaultDir, "gone.html", "<html><body><p>deletablecontent</p></body></html>");
    await syncVault(vault.db.db, vault.vaultDir);

    fs.rmSync(path.join(vault.vaultDir, "gone.html"));
    const result = await syncVault(vault.db.db, vault.vaultDir);

    expect(result.removed).toBe(1);
    expect(searchNotes(vault.db.db, "deletablecontent")).toHaveLength(0);
  });

  it("re-indexes a changed HTML page on scoped sync", async () => {
    const vault = createTempVault();
    const target = path.join(vault.vaultDir, "p.html");
    writeFile(vault.vaultDir, "p.html", "<html><body><p>beforeword</p></body></html>");
    await syncVault(vault.db.db, vault.vaultDir);

    fs.writeFileSync(target, "<html><body><p>afterword</p></body></html>", "utf-8");
    await syncChangedFiles(vault.db.db, vault.vaultDir, [target]);

    expect(searchNotes(vault.db.db, "afterword")).toHaveLength(1);
    expect(searchNotes(vault.db.db, "beforeword")).toHaveLength(0);
  });

  it("resolves links between notes and HTML pages through the graph", async () => {
    const vault = createTempVault();
    writeFile(vault.vaultDir, "index.html", '<html><body><a href="target.md">to note</a></body></html>');
    writeFile(vault.vaultDir, "target.md", "---\ntitle: Target\n---\n[back](index.html)\n");
    await syncVault(vault.db.db, vault.vaultDir);

    const page = getNote(vault.db.db, "index_html");
    expect(page?.graph.outlinks.map((link) => link.resolvedPath)).toContain("target.md");

    // A Markdown note's id comes from its frontmatter/path stem, not the filename.
    const graph = getGraph(vault.db.db, "target", { direction: "both" });
    const neighbours = graph?.nodes.map((node) => node.path) ?? [];
    expect(neighbours).toContain("index.html");
    expect(graph?.edges).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Write safety
// ---------------------------------------------------------------------------

describe("HTML write safety", () => {
  it("refuses to rewrite an indexed HTML page through updateNote", async () => {
    const vault = createTempVault();
    const original = "<html><head><style>.x{color:red}</style></head><body><p>page word</p></body></html>";
    writeFile(vault.vaultDir, "page.html", original);
    await syncVault(vault.db.db, vault.vaultDir);

    await expect(
      updateNote(vault.db.db, vault.vaultDir, { id: "page_html", content: "replaced" } as never),
    ).rejects.toThrow(/read-only/i);

    expect(fs.readFileSync(path.join(vault.vaultDir, "page.html"), "utf-8")).toBe(original);
  });
});

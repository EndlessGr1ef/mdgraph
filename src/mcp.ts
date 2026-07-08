import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getGraph, getNote, getStatus, openDb, searchNotes } from "./db.js";
import { indexFile, syncVault, type SyncResult } from "./indexer.js";
import { assertInsideVault, resolveVaultRoot, toRelativePath } from "./paths.js";
import { watchVault } from "./watcher.js";

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  status?: string;
  tags?: string[];
  aliases?: string[];
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const nonce = Math.random().toString(16).slice(2);
  const tempPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${nonce}.tmp`);
  try {
    await fs.writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function updateNote(db: DatabaseHandle, vaultRoot: string, input: UpdateNoteInput) {
  const note = getNote(db, input.id);
  if (!note) {
    throw new Error(`Note not found: ${input.id}`);
  }

  const targetPath = assertInsideVault(vaultRoot, note.path);
  let raw: string;
  try {
    raw = await fs.readFile(targetPath, "utf8");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      throw new Error(`Note file not found on disk: ${note.path}`);
    }
    throw error;
  }
  const parsed = matter(raw);
  const frontmatter: Record<string, unknown> = {
    ...parsed.data,
    id: note.id,
    updated: new Date().toISOString().slice(0, 10),
  };

  if (input.title !== undefined) frontmatter.title = input.title;
  if (input.type !== undefined) frontmatter.type = input.type;
  if (input.status !== undefined) frontmatter.status = input.status;
  if (input.tags !== undefined) frontmatter.tags = input.tags;
  if (input.aliases !== undefined) frontmatter.aliases = input.aliases;

  const markdown = matter.stringify(input.content ?? parsed.content, frontmatter);
  await writeFileAtomic(targetPath, markdown);
  await indexFile(db, vaultRoot, targetPath);

  return { success: true, id: note.id, path: toRelativePath(vaultRoot, targetPath) };
}

export async function startMcpServer(vault?: string): Promise<void> {
  const vaultRoot = resolveVaultRoot(vault);
  const store = openDb(vaultRoot);
  const server = new McpServer({ name: "mdgraph", version: "0.1.0" });
  let syncInProgress: Promise<SyncResult> | undefined;
  let lastSync:
    | {
        at: string;
        result?: SyncResult;
        error?: string;
      }
    | undefined;

  async function runSync(): Promise<SyncResult> {
    if (syncInProgress) return syncInProgress;
    syncInProgress = syncVault(store.db, vaultRoot)
      .then((result) => {
        lastSync = { at: new Date().toISOString(), result };
        return result;
      })
      .catch((error) => {
        lastSync = { at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
        throw error;
      })
      .finally(() => {
        syncInProgress = undefined;
      });
    return syncInProgress;
  }

  await runSync();
  watchVault(store.db, vaultRoot);

  server.tool("mdgraph_status", "Show MDGraph index status", {}, async () => {
    return jsonResult({ vault: vaultRoot, watch_enabled: true, last_sync: lastSync, ...getStatus(store.db) });
  });

  server.tool(
    "mdgraph_search",
    "Search indexed Markdown notes with SQLite FTS5 (matches title, path/filename, body, tags, and aliases). Each result includes a compact graph summary with link counts and preview.",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(10),
      status: z.string().optional(),
      type: z.string().optional(),
      tag: z.string().optional(),
    },
    async ({ query, limit, status, type, tag }) => {
      return jsonResult(searchNotes(store.db, query, { limit, status, type, tag }));
    },
  );

  server.tool(
    "mdgraph_get_note",
    "Get a note by id, including its Markdown body, metadata, and 1-hop graph context (outlinks, backlinks, broken links, ambiguous links). Graph arrays are bounded by graphLimit (default 20); use total* fields for real counts.",
    {
      id: z.string().min(1),
      graphLimit: z.number().int().min(1).max(100).default(20),
    },
    async ({ id, graphLimit }) => {
      const note = getNote(store.db, id, { graphLimit });
      return jsonResult(note ?? { error: `Note not found: ${id}` });
    },
  );

  server.tool(
    "mdgraph_get_graph",
    "Get a configurable graph of linked notes around a root note. Supports depth, direction (out/back/both), and maxNodes.",
    {
      id: z.string().min(1),
      depth: z.number().int().min(1).max(10).default(1),
      direction: z.enum(["out", "back", "both"]).default("both"),
      maxNodes: z.number().int().min(1).max(500).default(100),
    },
    async ({ id, depth, direction, maxNodes }) => {
      return jsonResult(getGraph(store.db, id, { depth, direction, maxNodes }) ?? { error: `Note not found: ${id}` });
    },
  );

  server.tool("mdgraph_sync", "Rescan the Markdown vault and update the index", {}, async () => {
    const result = await runSync();
    return jsonResult(result);
  });

  server.tool(
    "mdgraph_create_note",
    "Create a Markdown note under the vault and index it",
    {
      path: z.string().min(1),
      title: z.string().min(1),
      content: z.string().default(""),
      type: z.string().default("note"),
      status: z.string().default("active"),
      tags: z.array(z.string()).default([]),
    },
    async (input) => {
      const targetPath = assertInsideVault(vaultRoot, input.path.endsWith(".md") ? input.path : `${input.path}.md`);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const now = new Date().toISOString().slice(0, 10);
      const id = input.path
        .replace(/\.md$/i, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
      const markdown = matter.stringify(input.content, {
        id,
        title: input.title,
        type: input.type,
        status: input.status,
        tags: input.tags,
        created: now,
        updated: now,
      });
      await fs.writeFile(targetPath, markdown, { encoding: "utf8", flag: "wx" });
      await indexFile(store.db, vaultRoot, targetPath);
      return jsonResult({ success: true, id, path: toRelativePath(vaultRoot, targetPath) });
    },
  );

  server.tool(
    "mdgraph_update_note",
    "Update an existing Markdown note by id and reindex it",
    {
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      type: z.string().min(1).optional(),
      status: z.string().min(1).optional(),
      tags: z.array(z.string()).optional(),
      aliases: z.array(z.string()).optional(),
    },
    async (input) => {
      return jsonResult(await updateNote(store.db, vaultRoot, input));
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

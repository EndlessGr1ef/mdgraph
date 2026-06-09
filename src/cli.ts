#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { openDb, getNote, getStatus, searchNotes } from "./db.js";
import { syncVault } from "./indexer.js";
import { resolveVaultRoot } from "./paths.js";
import { watchVault } from "./watcher.js";
import { startMcpServer } from "./mcp.js";

const program = new Command();

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

program
  .name("mdgraph")
  .description("Local-first Markdown knowledge graph for AI agents")
  .option("-v, --vault <path>", "Markdown vault root", process.cwd())
  .version("0.1.0");

program
  .command("init")
  .description("Create the local index and scan Markdown files")
  .action(async () => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    try {
      const result = await syncVault(store.db, vaultRoot);
      console.log(JSON.stringify({ vault: vaultRoot, ...result }, null, 2));
    } finally {
      store.close();
    }
  });

program
  .command("sync")
  .description("Rescan Markdown files and refresh the index")
  .action(async () => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    try {
      const result = await syncVault(store.db, vaultRoot);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      store.close();
    }
  });

program
  .command("status")
  .description("Show index status")
  .action(() => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    try {
      console.log(JSON.stringify({ vault: vaultRoot, ...getStatus(store.db) }, null, 2));
    } finally {
      store.close();
    }
  });

program
  .command("search")
  .description("Search indexed Markdown notes")
  .argument("<query>", "Search query")
  .option("-l, --limit <number>", "Max results", parsePositiveInt, 10)
  .option("--status <status>", "Filter by status")
  .option("--type <type>", "Filter by type")
  .option("--tag <tag>", "Filter by tag")
  .action((query, options) => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    try {
      const results = searchNotes(store.db, query, {
        limit: Number(options.limit),
        status: options.status,
        type: options.type,
        tag: options.tag,
      });
      console.log(JSON.stringify(results, null, 2));
    } finally {
      store.close();
    }
  });

program
  .command("get")
  .description("Get a note by id")
  .argument("<id>", "Note id")
  .action((id) => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    try {
      console.log(JSON.stringify(getNote(store.db, id), null, 2));
    } finally {
      store.close();
    }
  });

program
  .command("watch")
  .description("Watch Markdown files and keep the index fresh")
  .action(() => {
    const vaultRoot = resolveVaultRoot(program.opts().vault);
    const store = openDb(vaultRoot);
    watchVault(store.db, vaultRoot);
  });

program
  .command("mcp")
  .description("Run the MDGraph MCP server over stdio")
  .action(async () => {
    await startMcpServer(program.opts().vault);
  });

await program.parseAsync(process.argv);

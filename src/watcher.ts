import path from "node:path";
import chokidar from "chokidar";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { indexFile, isMarkdownPath, removeFile } from "./indexer.js";
import { createIgnoreChecker } from "./ignore.js";

export function watchVault(db: DatabaseHandle, vaultRoot: string): ReturnType<typeof chokidar.watch> {
  const isIgnored = createIgnoreChecker(vaultRoot);

  const watcher = chokidar.watch(vaultRoot, {
    ignored: (filePath: string) => {
      const relative = path.relative(vaultRoot, path.resolve(filePath));
      if (relative === "" || relative === ".") return false;
      return isIgnored(relative);
    },
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on("add", (filePath) => handleChange(db, vaultRoot, filePath));
  watcher.on("change", (filePath) => handleChange(db, vaultRoot, filePath));
  watcher.on("unlink", (filePath) => handleRemove(db, vaultRoot, filePath));
  watcher.on("error", (error) => console.error("watch error", error));

  console.error(`MDGraph watching ${vaultRoot}`);
  return watcher;
}

async function handleChange(db: DatabaseHandle, vaultRoot: string, filePath: string): Promise<void> {
  if (!isMarkdownPath(filePath)) return;
  const targetPath = path.isAbsolute(filePath) ? filePath : path.join(vaultRoot, filePath);
  try {
    await indexFile(db, vaultRoot, targetPath);
    console.error(`indexed ${filePath}`);
  } catch (error) {
    console.error(`failed to index ${filePath}`, error);
  }
}

async function handleRemove(db: DatabaseHandle, vaultRoot: string, filePath: string): Promise<void> {
  if (!isMarkdownPath(filePath)) return;
  const targetPath = path.isAbsolute(filePath) ? filePath : path.join(vaultRoot, filePath);
  try {
    await removeFile(db, vaultRoot, targetPath);
    console.error(`removed ${filePath}`);
  } catch (error) {
    console.error(`failed to remove ${filePath}`, error);
  }
}

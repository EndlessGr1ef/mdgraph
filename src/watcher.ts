import path from "node:path";
import chokidar from "chokidar";
import type { Database as DatabaseHandle } from "better-sqlite3";
import { syncChangedFiles, syncVault, isMarkdownPath } from "./indexer.js";
import { createIgnoreChecker } from "./ignore.js";

// Adaptive debounce: a pending set this small fires after the quick quiet
// window instead of the full debounce, so a lone save syncs near-instantly
// while a larger burst keeps the full window and coalesces.
const QUICK_SYNC_MAX_PENDING = 2;
const QUICK_SYNC_QUIET_MS = 300;
const DEFAULT_DEBOUNCE_MS = 2000;

// Scoped-sync ceiling: above this many pending files a full scan-diff is
// simpler and comparably fast, and it self-heals anything event coalescing
// dropped along the way.
const SCOPED_SYNC_MAX_PENDING = 500;

// Pure scheduling decisions (exported so the flush lifecycle can be tested
// without driving a real chokidar + debounce timeline).
//
// Window selection: a tiny pending set fires after the quick quiet window so a
// lone save syncs near-instantly, while a larger burst keeps the full debounce
// and coalesces.
export function pickWindowMs(pendingCount: number): number {
  return pendingCount <= QUICK_SYNC_MAX_PENDING ? QUICK_SYNC_QUIET_MS : DEFAULT_DEBOUNCE_MS;
}

// Whether the next flush must be a full scan-diff rather than a precise path
// list: a directory-level event, an empty set, or an event storm cannot be
// described by scoped paths.
export function isScopedSync(needsFullScan: boolean, pendingCount: number): boolean {
  if (needsFullScan) return false;
  if (pendingCount === 0) return false;
  if (pendingCount > SCOPED_SYNC_MAX_PENDING) return false;
  return true;
}

// Whether the flush must re-arm itself after completing: any backlog left
// un-consumed (mid-flush events survive past the flush's startedAt watermark)
// OR an unmet full-scan demand (e.g. a directory removed while a flush was
// in flight) must be picked up by a follow-up flush. Re-arming on needsFullScan
// alone is what keeps a deletion from being swallowed.
export function shouldReschedule(pendingCount: number, needsFullScan: boolean): boolean {
  return pendingCount > 0 || needsFullScan;
}

export function watchVault(db: DatabaseHandle, vaultRoot: string): ReturnType<typeof chokidar.watch> {
  const isIgnored = createIgnoreChecker(vaultRoot);

  // Absolute path -> lastSeenMs for every reported markdown change. Events
  // arriving while a flush is in flight survive into a follow-up flush.
  const pending = new Map<string, number>();
  let needsFullScan = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;

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

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function scheduleFlush(): void {
    clearTimer();
    const delay = pickWindowMs(pending.size);
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, delay);
  }

  function withinVault(filePath: string): boolean {
    const relative = path.relative(vaultRoot, path.resolve(filePath));
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }

  function enqueueChange(filePath: string): void {
    if (!isMarkdownPath(filePath) || !withinVault(filePath)) return;
    pending.set(path.resolve(filePath), Date.now());
    scheduleFlush();
  }

  function enqueueFullScan(): void {
    needsFullScan = true;
    scheduleFlush();
  }

  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    const startedAt = Date.now();
    const scopedPaths = [...pending.keys()];

    // Directory removal / an event storm / an empty set cannot be described by
    // a precise path list, so run the full scan-diff (the ground truth).
    const full = !isScopedSync(needsFullScan, scopedPaths.length);

    try {
      if (full) {
        const result = await syncVault(db, vaultRoot);
        for (const [p, seen] of pending) {
          if (seen <= startedAt) pending.delete(p);
        }
        needsFullScan = false;
        console.error(
          `full sync: ${result.indexed} indexed, ${result.removed} removed${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
        );
      } else {
        const result = await syncChangedFiles(db, vaultRoot, scopedPaths);
        for (const [p, seen] of pending) {
          if (seen <= startedAt) pending.delete(p);
        }
        console.error(
          `scoped sync (${scopedPaths.length} path${scopedPaths.length === 1 ? "" : "s"}): ${result.indexed} indexed, ${result.removed} removed${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
        );
      }
    } finally {
      flushing = false;
      // Events that landed during the flush (seen > startedAt) remain pending,
      // and a full-scan demand raised mid-flush (e.g. a directory removed while
      // the scan was in flight) is still unmet — re-arm so either is honored.
      if (shouldReschedule(pending.size, needsFullScan)) scheduleFlush();
    }
  }

  watcher.on("add", (filePath) => enqueueChange(filePath));
  watcher.on("change", (filePath) => enqueueChange(filePath));
  watcher.on("unlink", (filePath) => enqueueChange(filePath));
  watcher.on("addDir", () => enqueueFullScan());
  watcher.on("unlinkDir", () => enqueueFullScan());
  watcher.on("error", (error) => console.error("watch error", error));

  // Initial catch-up: on start, chokidar reports nothing for pre-existing
  // files (ignoreInitial), so seed the index with a full scan.
  watcher.once("ready", () => {
    void syncVault(db, vaultRoot)
      .then((result) => console.error(`initial sync: ${result.indexed} indexed, ${result.removed} removed`))
      .catch((error) => console.error("initial sync failed", error));
  });

  console.error(`MDGraph watching ${vaultRoot}`);
  return watcher;
}

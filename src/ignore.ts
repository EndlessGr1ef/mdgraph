import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";

/**
 * Built-in ignore patterns that always apply.
 * Patterns are in fast-glob/micromatch format, relative to vault root.
 */
export const BUILTIN_IGNORE_PATTERNS: readonly string[] = [
  "**/.git",
  "**/.git/**",
  "**/.mdgraph",
  "**/.mdgraph/**",
  "**/node_modules",
  "**/node_modules/**",
  "**/dist",
  "**/dist/**",
  "**/_template.md",
];

/**
 * Load custom ignore patterns from vaultRoot/.mdgraphignore.
 * Returns an empty array if the file doesn't exist or can't be read.
 *
 * - Each non-empty line is a glob pattern.
 * - Lines starting with `#` are treated as comments and skipped.
 */
export function loadCustomIgnorePatterns(vaultRoot: string): string[] {
  const ignoreFile = path.join(vaultRoot, ".mdgraphignore");
  try {
    const content = fs.readFileSync(ignoreFile, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Get all ignore patterns: built-in plus any custom patterns from .mdgraphignore.
 */
export function getIgnorePatterns(vaultRoot: string): string[] {
  return [...BUILTIN_IGNORE_PATTERNS, ...loadCustomIgnorePatterns(vaultRoot)];
}

/**
 * Compile ignore patterns into the same matcher used by watch and sync filtering.
 */
export function compileGlobMatcher(patterns: string[]): (filePath: string) => boolean {
  if (patterns.length === 0) return () => false;
  const isMatch = picomatch(patterns, { dot: true });

  return (filePath: string) => {
    const normalized = filePath.replace(/\\/g, "/");
    return isMatch(normalized);
  };
}

/**
 * Create a convenience checker that loads patterns from the vault root
 * and returns a function to test vault-relative paths.
 */
export function createIgnoreChecker(vaultRoot: string): (relativePath: string) => boolean {
  const patterns = getIgnorePatterns(vaultRoot);
  return compileGlobMatcher(patterns);
}

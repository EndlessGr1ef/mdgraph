import path from "node:path";

export function resolveVaultRoot(vault?: string): string {
  return path.resolve(vault ?? process.cwd());
}

export function resolveStoreDir(vaultRoot: string): string {
  return path.join(vaultRoot, ".mdgraph");
}

export function resolveDbPath(vaultRoot: string): string {
  return path.join(resolveStoreDir(vaultRoot), "mdgraph.db");
}

export function toRelativePath(vaultRoot: string, filePath: string): string {
  return path.relative(vaultRoot, path.resolve(filePath)).split(path.sep).join("/");
}

export function assertInsideVault(vaultRoot: string, targetPath: string): string {
  const resolved = path.resolve(vaultRoot, targetPath);
  const relative = path.relative(vaultRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes vault: ${targetPath}`);
  }
  return resolved;
}

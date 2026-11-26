import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Single source of truth for the reported version. src/ and dist/ sit at the
 * same depth, so package.json is always one level up from this module.
 */
function readPackageVersion(): string {
  try {
    const packagePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = readPackageVersion();

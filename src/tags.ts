import type { Database as DatabaseHandle } from "better-sqlite3";

const INLINE_TAG_RE = /(?:^|[\s(（[【"'，。；：、])#([\p{L}_][\p{L}\p{N}_\-/]{0,63})/gu;
const CJK_RE = /\p{Script=Han}/u;

const MAX_DERIVED_TAGS = 10;
const MAX_VOCAB_TAGS = 5;

/**
 * Normalize a tag for storage and search: trim, drop leading '#'s, and fold
 * ASCII letters to lowercase so the vocabulary converges on one spelling.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

/**
 * Extract Obsidian-style inline tags (#tag) from Markdown body text.
 * Fenced code blocks and inline code are ignored so code samples never
 * leak pseudo-tags like colors or shell comments.
 */
export function extractInlineTags(content: string): string[] {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ");
  const tags = new Set<string>();
  for (const match of stripped.matchAll(INLINE_TAG_RE)) {
    tags.add(normalizeTag(match[1]));
  }
  return [...tags];
}

function stripPathPrefix(segment: string): string {
  return segment.replace(/^\d{8}_\d{6}_/, "").replace(/^\d+_/, "");
}

function isCjk(value: string): boolean {
  return CJK_RE.test(value);
}

/**
 * Deterministic tag derivation for new notes, so retrieval does not depend
 * on the calling model remembering to supply tags:
 *
 * 1. inline #tags found in the body,
 * 2. the deepest folder name in the vault-relative path (timestamp prefixes
 *    stripped), and
 * 3. existing vault tags that appear verbatim in the title, body, or path
 *    (reuses the controlled vocabulary; CJK tags need >= 2 chars, ASCII tags
 *    >= 3 chars to avoid accidental substring hits).
 */
export function deriveTags(
  db: DatabaseHandle,
  relPath: string,
  title: string,
  content: string,
): string[] {
  const tags = new Set<string>();

  for (const tag of extractInlineTags(content)) tags.add(tag);

  const deepestDir = relPath
    .split("/")
    .slice(0, -1)
    .map(stripPathPrefix)
    .filter(Boolean)
    .at(-1);
  if (deepestDir && [...deepestDir].length >= 2) {
    tags.add(normalizeTag(deepestDir));
  }

  const haystack = `${title}\n${content}\n${relPath}`.toLowerCase();
  const vocabMatches = (db.prepare("SELECT DISTINCT tag FROM tags").all() as Array<{ tag: string }>)
    .map((row) => normalizeTag(row.tag))
    .filter((tag) => [...tag].length >= 2 && (isCjk(tag) || tag.length >= 3))
    .filter((tag) => haystack.includes(tag))
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_VOCAB_TAGS);
  for (const tag of vocabMatches) tags.add(tag);

  return [...tags].slice(0, MAX_DERIVED_TAGS);
}

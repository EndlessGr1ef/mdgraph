import path from "node:path";
import matter from "gray-matter";
import type { MarkdownHeading, ParsedNote } from "./types.js";
import { extractInlineTags } from "./tags.js";

const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const MARKDOWN_LINK_RE = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g;
const ATX_HEADING_RE = /^(#{1,6})[ \t]+(.+?)\s*$/;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractLinks(body: string): string[] {
  const links = new Set<string>();
  for (const match of body.matchAll(WIKI_LINK_RE)) {
    links.add(match[1].trim());
  }
  for (const match of body.matchAll(MARKDOWN_LINK_RE)) {
    const target = match[1].trim();
    if (target.endsWith(".md")) {
      links.add(target);
    }
  }
  return [...links];
}

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "heading";
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export function extractHeadings(body: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const stack: MarkdownHeading[] = [];
  const seen = new Map<string, number>();
  let position = 0;

  const lines = body.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const match = ATX_HEADING_RE.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      if (text) {
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        const heading: MarkdownHeading = {
          level,
          text,
          slug: slugifyHeading(text, seen),
          line: index + 1,
          position,
          path: [...stack.map((item) => item.text), text],
        };
        headings.push(heading);
        stack.push(heading);
      }
    }
    position += rawLine.length + 1;
  }

  return headings;
}

function fallbackId(relativePath: string): string {
  return relativePath
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function parseMarkdownNote(relativePath: string, raw: string): ParsedNote {
  const parsed = matter(raw);
  const frontmatter = parsed.data as Record<string, unknown>;
  const body = parsed.content;
  const stem = path.basename(relativePath, path.extname(relativePath));

  const id = asString(frontmatter.id, fallbackId(relativePath));
  const title = asString(frontmatter.title, stem);
  const type = asString(frontmatter.type, "note");
  const status = asString(frontmatter.status, "active");
  const tags = [...new Set([...asStringArray(frontmatter.tags), ...extractInlineTags(body)])];
  const aliases = asStringArray(frontmatter.aliases);
  const created = asString(frontmatter.created, "") || null;
  const updated = asString(frontmatter.updated, "") || null;

  return {
    id,
    path: relativePath,
    title,
    type,
    status,
    tags,
    aliases,
    created,
    updated,
    frontmatter,
    body,
    headings: extractHeadings(body),
    links: extractLinks(body),
  };
}

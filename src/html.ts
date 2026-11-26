import path from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { MarkdownHeading, ParsedNote } from "./types.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];

/**
 * Subtrees that never belong in the search body. Script/style/svg carry code,
 * and nav/footer repeat chrome across pages, so indexing them makes every page
 * match unrelated queries.
 */
const DROPPED_ELEMENTS = new Set(["script", "style", "svg", "noscript", "template", "nav", "footer"]);

/**
 * Diagram source rendered by JS lives in a `<pre class="mermaid">` text node,
 * not inside <script>, so element-name rules never reach it. Left in, every
 * diagram-bearing page matches on "graph LR" and similar DSL tokens.
 */
const DROPPED_CLASSES = new Set(["mermaid"]);

const HEADING_LEVELS: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };

/** Elements whose boundaries separate words in the extracted body text. */
const BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "details", "div", "dl", "dt",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main",
  "ol", "p", "pre", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

function isElement(node: Node | undefined): node is Element {
  return node !== undefined && "tagName" in node;
}

function isText(node: Node): node is TextNode {
  return "value" in node;
}

function isDropped(element: Element): boolean {
  if (DROPPED_ELEMENTS.has(element.tagName)) return true;
  const classAttribute = getAttribute(element, "class");
  if (!classAttribute) return false;
  return classAttribute.split(/\s+/).some((token) => DROPPED_CLASSES.has(token));
}

function getAttribute(element: Element, name: string): string | undefined {
  const attribute = element.attrs.find((item) => item.name === name);
  const value = attribute?.value.trim();
  return value ? value : undefined;
}

function textOf(node: Node): string {
  if (isText(node)) return node.value;
  if (!isElement(node) || isDropped(node)) return "";
  return node.childNodes.map(textOf).join("");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function findElement(root: Node, predicate: (element: Element) => boolean): Element | undefined {
  const stack: Node[] = [root];
  while (stack.length) {
    const node = stack.pop() as Node;
    if (isElement(node) && predicate(node)) return node;
    if (isElement(node) && isDropped(node)) continue;
    if ("childNodes" in node) stack.push(...node.childNodes);
  }
  return undefined;
}

/**
 * Collect visible text with block-level separators preserved, so the FTS body
 * reads as paragraphs rather than one concatenated run of characters.
 */
function extractBodyText(root: Node): string {
  const parts: string[] = [];

  const visit = (node: Node): void => {
    if (isText(node)) {
      parts.push(node.value);
      return;
    }
    if (isElement(node) && isDropped(node)) return;
    // The #document root and the doctype carry no tagName; descend through
    // them instead of returning, or the whole body is skipped.
    if ("childNodes" in node) {
      const block = isElement(node) && BLOCK_ELEMENTS.has(node.tagName);
      if (block) parts.push("\n");
      for (const child of node.childNodes) visit(child);
      if (block) parts.push("\n");
    }
  };

  visit(root);
  return parts
    .join("")
    .split("\n")
    .map(collapse)
    .filter(Boolean)
    .join("\n");
}

/**
 * Headings reuse the document's own `id` as the slug when present, because that
 * is what an in-page `#fragment` link actually resolves to.
 */
function extractHtmlHeadings(root: Node): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const stack: MarkdownHeading[] = [];
  const seen = new Set<string>();
  let position = 0;

  const visit = (node: Node): void => {
    if (isElement(node) && isDropped(node)) return;
    const level = isElement(node) ? HEADING_LEVELS[node.tagName] : undefined;
    if (level !== undefined && isElement(node)) {
      const text = collapse(textOf(node));
      if (text) {
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        let slug = getAttribute(node, "id") ?? text.toLowerCase().replace(/\s+/g, "-");
        if (seen.has(slug)) {
          let suffix = 2;
          while (seen.has(`${slug}-${suffix}`)) suffix += 1;
          slug = `${slug}-${suffix}`;
        }
        seen.add(slug);
        const heading: MarkdownHeading = {
          level,
          text,
          slug,
          line: 0,
          position,
          path: [...stack.map((item) => item.text), text],
        };
        position += text.length + 1;
        headings.push(heading);
        stack.push(heading);
      }
    }
    if ("childNodes" in node) {
      for (const child of node.childNodes) visit(child);
    }
  };

  visit(root);
  return headings;
}

/**
 * Only vault-local document links are graph edges. Absolute URLs, mailto,
 * javascript, protocol-relative URLs and bare fragments point outside the
 * vault, so they are not indexed as links. Windows-style backslashes are
 * rejected too: vault paths are POSIX, so such an href cannot resolve.
 */
function isVaultLocalTarget(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith("#")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  return true;
}

/**
 * Turn an href into the vault-relative target the graph resolves. The query
 * string and fragment are dropped, and percent-encoding is decoded because
 * disk paths are unencoded: "my%20report.md" links to the file "my report.md".
 */
function normalizeHref(href: string): string | undefined {
  const withoutFragment = href.split("#")[0].split("?")[0].trim();
  if (!withoutFragment) return undefined;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

function extractHtmlLinks(root: Node): string[] {
  const links = new Set<string>();
  const visit = (node: Node): void => {
    if (isElement(node) && isDropped(node)) return;
    if (isElement(node) && node.tagName === "a") {
      const href = getAttribute(node, "href");
      if (href && isVaultLocalTarget(href)) {
        const target = normalizeHref(href);
        if (target) links.add(target);
      }
    }
    if ("childNodes" in node) {
      for (const child of node.childNodes) visit(child);
    }
  };
  visit(root);
  return [...links];
}

/**
 * HTML has no frontmatter, so metadata comes from the document itself: the
 * <title> or first h1, and a `<meta name="...">` tag when one is present.
 */
function readMeta(document: Node, names: string[]): string | undefined {
  for (const name of names) {
    const meta = findElement(
      document,
      (element) => element.tagName === "meta" && getAttribute(element, "name") === name,
    );
    if (meta) {
      const content = getAttribute(meta, "content");
      if (content) return content;
    }
  }
  return undefined;
}

function readTitle(document: Node, headings: MarkdownHeading[], relativePath: string): string {
  const titleElement = findElement(document, (element) => element.tagName === "title");
  const titleText = titleElement ? collapse(textOf(titleElement)) : "";
  if (titleText) return titleText;
  const firstH1 = headings.find((heading) => heading.level === 1);
  if (firstH1) return firstH1.text;
  return path.basename(relativePath, path.extname(relativePath));
}

function asTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Note ids are path-derived for HTML instead of frontmatter-derived. Stripping
 * only ".md" would let "a.html" and "a.md" collide on the same id, which
 * upsertNote rejects as a duplicate, so the full relative path is the stem.
 */
function htmlId(relativePath: string): string {
  return relativePath.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export function isHtmlPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".html" || ext === ".htm";
}

export function parseHtmlPage(relativePath: string, raw: string): ParsedNote {
  // parse() returns a "#document" node, which has childNodes but no tagName.
  // Walking from it reaches <html> and everything below.
  const root = parse(raw) as Node;
  const headings = extractHtmlHeadings(root);
  const body = extractBodyText(root);
  const title = readTitle(root, headings, relativePath);

  const metaTags = readMeta(root, ["keywords", "tags"]);
  const metaDate = readMeta(root, ["date", "dcterms.date", "pubdate"]);

  return {
    id: htmlId(relativePath),
    path: relativePath,
    title,
    type: "page",
    status: "active",
    tags: asTags(metaTags),
    aliases: [],
    created: metaDate ?? null,
    updated: null,
    frontmatter: {
      title,
      description: readMeta(root, ["description"]),
      lang: (isElement(root) ? getAttribute(root, "lang") : undefined) ?? undefined,
    },
    body,
    headings,
    links: extractHtmlLinks(root),
  };
}

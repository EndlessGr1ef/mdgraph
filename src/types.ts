export type NoteStatus = "active" | "superseded" | "archived" | "deleted" | string;

export interface MarkdownHeading {
  level: number;
  text: string;
  slug: string;
  line: number;
  position: number;
  path: string[];
}

export interface ParsedNote {
  id: string;
  path: string;
  title: string;
  type: string;
  status: NoteStatus;
  tags: string[];
  aliases: string[];
  created: string | null;
  updated: string | null;
  frontmatter: Record<string, unknown>;
  body: string;
  headings: MarkdownHeading[];
  links: string[];
}

export interface SearchOptions {
  limit?: number;
  status?: string;
  type?: string;
  tag?: string;
}

export interface SearchResult {
  id: string;
  path: string;
  title: string;
  type: string;
  status: string;
  tags: string[];
  snippet: string;
  outline: MarkdownHeading[];
  rank: number;
  graph?: GraphSummary;
}

// --- Graph types ---

export interface ResolveCandidate {
  id: string;
  path: string;
  title: string;
}

export interface ResolvedLinkTarget {
  rawTarget: string;
  resolvedId?: string;
  resolvedPath?: string;
  resolvedTitle?: string;
}

export interface AmbiguousLink {
  rawTarget: string;
  candidates: ResolveCandidate[];
}

export interface NoteGraph {
  outlinks: ResolvedLinkTarget[];
  backlinks: ResolvedLinkTarget[];
  brokenLinks: string[];
  ambiguousLinks: AmbiguousLink[];
  totalOutlinks: number;
  totalBacklinks: number;
  totalBroken: number;
  totalAmbiguous: number;
}

export interface GraphSummary {
  outlinks: number;
  backlinks: number;
  broken: number;
  outlinks_preview: { id: string; title: string }[];
  backlinks_preview: { id: string; title: string }[];
}

export type GraphDirection = "out" | "back" | "both";

export interface GraphOptions {
  depth?: number;
  direction?: GraphDirection;
  maxNodes?: number;
}

export interface GraphNode {
  id: string;
  path: string;
  title: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphResult {
  root: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

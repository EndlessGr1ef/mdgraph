/** Initialize-time usage guidance exposed by the MCP server. */
export const MCP_INSTRUCTIONS = [
  "1. Use mdgraph_explore_notes for open questions; use mdgraph_search for precise title or tag lookups, and mdgraph_get_note for a known id.",
  "2. Answer-note bodies are current index content: treat them as already read, and do not re-read the file unless the response says stale.",
  "3. \"already served earlier in this conversation\" is a pointer, not a gap: scroll back instead of re-fetching.",
  "4. The index lags writes by about a second; prefer mdgraph_create_note and mdgraph_update_note, though external edits are picked up by the watcher and read-time freshness.",
  "5. When an answer needs more of a truncated note, call mdgraph_get_note with its id; it returns the whole note.",
].join("\n");

// Pure logic for the search-docs MCP server.
//
// Side-effect free helpers extracted from index.ts so they can be unit- and
// mutation-tested without booting the stdio transport or reaching Ollama/Qdrant.
// index.ts keeps the network I/O (embed, qdrant.search) and server wiring and
// delegates query-validation, filter construction, snippet shaping, and result
// mapping to this module.

export type PointPayload = {
  file_path?: string
  keywords?: string[]
  parent_headings?: string[]
  source_file?: string
  text?: string
  title?: string
  type?: string
}

export type RawHit = {
  payload?: PointPayload | null
  score: number
}

export type Hit = {
  source_file: string
  file_path: string
  title: string
  parent_headings: string[]
  score: number
  snippet: string
}

export type TopKResult = { ok: true; value: number } | { ok: false; message: string }

export const DEFAULT_TOP_K = 5

// Resolve the optional top_k (default 5) and enforce the documented [1, 20]
// integer bound. Returns a structured error message on violation.
export const resolveTopK = (top_k?: number): TopKResult => {
  const topK = top_k ?? DEFAULT_TOP_K
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
    return { ok: false, message: `top_k must be an integer in [1, 20]. Received: ${topK}.` }
  }
  return { ok: true, value: topK }
}

export type QdrantFilter = { must: Array<{ key: string; match: { value: string } }> }

// Build a Qdrant `must` filter from the optional payload filters. Returns
// undefined when neither filter is supplied (unfiltered search).
export const buildFilter = (type?: string, sourceFile?: string): QdrantFilter | undefined => {
  const must: QdrantFilter['must'] = []
  if (type) must.push({ key: 'type', match: { value: type } })
  if (sourceFile) must.push({ key: 'source_file', match: { value: sourceFile } })
  return must.length > 0 ? { must } : undefined
}

// Collapse whitespace and truncate to 200 chars for a compact preview.
export const snippet = (text: string | undefined): string => {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

// Map raw Qdrant hits to the tool's compact output shape, defaulting missing
// payload fields rather than emitting undefined.
export const mapHits = (results: RawHit[]): Hit[] =>
  results.map((r) => {
    const p = (r.payload ?? {}) as PointPayload
    return {
      source_file: p.source_file ?? '',
      file_path: p.file_path ?? '',
      title: p.title ?? '',
      parent_headings: p.parent_headings ?? [],
      score: r.score,
      snippet: snippet(p.text),
    }
  })

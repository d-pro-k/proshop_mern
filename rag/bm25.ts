const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'this', 'that',
  // Russian
  'и', 'в', 'не', 'на', 'с', 'что', 'это', 'к', 'по', 'за', 'из', 'у', 'о', 'но',
  'а', 'для', 'как', 'если', 'или', 'же', 'вы', 'мы', 'он', 'она', 'они',
])

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))

// DJB2 hash → uint32 token ID; collisions are rare across ~5K unique tokens
export const tokenId = (token: string): number => {
  let hash = 5381
  for (let i = 0; i < token.length; i++) hash = (hash * 33) ^ token.charCodeAt(i)
  return hash >>> 0
}

export const bm25Sparse = (text: string): { indices: number[]; values: number[] } => {
  const counts = new Map<number, number>()
  for (const tok of tokenize(text)) {
    const id = tokenId(tok)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const indices: number[] = []
  const values: number[] = []
  for (const [id, freq] of counts) {
    indices.push(id)
    values.push(freq)
  }
  return { indices, values }
}

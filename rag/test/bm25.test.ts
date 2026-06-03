import { describe, it, expect } from 'vitest';
import { tokenId, bm25Sparse } from '../bm25';

// Reference DJB2 reimplemented independently of the module under test, so the
// expected ids below are derived from the algorithm spec (hash=5381, *33 ^ code,
// >>>0) rather than copied from the implementation we are testing.
const djb2 = (token: string): number => {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 33) ^ token.charCodeAt(i);
  }
  return hash >>> 0;
};

const UINT32_MAX = 0xffffffff;

describe('tokenId', () => {
  it('returns the same id for the same token across repeated calls', () => {
    const first = tokenId('mongodb');
    const second = tokenId('mongodb');
    expect(second).toBe(first);
  });

  it('hashes the single character "a" to the exact DJB2 uint32 value 177604', () => {
    // hash=5381; (5381*33) ^ 97 = 177573 ^ 97 = 177604; 177604 >>> 0 = 177604
    expect(tokenId('a')).toBe(177604);
  });

  it('hashes the two-character "ab" to the exact DJB2 uint32 value 5860902', () => {
    // from 177604: (177604*33) ^ 98 = 5860932 ^ 98 = 5860902; >>> 0 unchanged
    expect(tokenId('ab')).toBe(5860902);
  });

  it('matches an independent DJB2 reference for a realistic token', () => {
    expect(tokenId('checkout')).toBe(djb2('checkout'));
  });

  it('produces an integer within the uint32 range for a token whose raw hash is negative', () => {
    // 'failover' drives the signed XOR accumulator negative before >>> 0 folds it
    // back into uint32; this pins the `>>> 0` conversion specifically.
    const id = tokenId('failover');
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThanOrEqual(UINT32_MAX);
    expect(id).toBe(djb2('failover'));
  });

  it('keeps long tokens inside the uint32 range rather than overflowing to a float', () => {
    const id = tokenId('replicationfailoverincident');
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThanOrEqual(UINT32_MAX);
  });

  it('maps distinct tokens to distinct ids for a realistic vocabulary slice', () => {
    const tokens = ['mongodb', 'replica', 'set', 'failover', 'checkout', 'incident'];
    const ids = tokens.map(tokenId);
    expect(new Set(ids).size).toBe(tokens.length);
  });
});

describe('bm25Sparse', () => {
  it('returns indices and values of equal length for a realistic sentence', () => {
    const { indices, values } = bm25Sparse(
      'MongoDB replica set failover during checkout incident',
    );
    expect(indices.length).toBe(values.length);
    // 7 distinct content words, none stop words, all >= 2 chars
    expect(indices.length).toBe(7);
  });

  it('emits indices that equal the tokenId of each kept token', () => {
    const { indices } = bm25Sparse('replica failover checkout incident');
    expect(indices).toEqual([
      tokenId('replica'),
      tokenId('failover'),
      tokenId('checkout'),
      tokenId('incident'),
    ]);
  });

  it('counts a word that appears twice as a frequency of 2', () => {
    const { indices, values } = bm25Sparse('failover during checkout failover');
    const idx = indices.indexOf(tokenId('failover'));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(values[idx]).toBe(2);
  });

  it('counts a word that appears three times as a frequency of 3', () => {
    const { indices, values } = bm25Sparse('incident incident incident checkout');
    const idx = indices.indexOf(tokenId('incident'));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(values[idx]).toBe(3);
    // the other content word still counts once
    expect(values[indices.indexOf(tokenId('checkout'))]).toBe(1);
  });

  it('drops English and Russian stop words while keeping content words', () => {
    const { indices } = bm25Sparse('the failover and checkout is в на incident');
    expect(indices).toEqual([
      tokenId('failover'),
      tokenId('checkout'),
      tokenId('incident'),
    ]);
  });

  it('excludes the ids of stop words from the produced indices', () => {
    const { indices } = bm25Sparse('the failover and checkout is в на incident');
    for (const stop of ['the', 'and', 'is', 'в', 'на']) {
      expect(indices).not.toContain(tokenId(stop));
    }
  });

  it('drops one-character tokens but keeps two-character content tokens', () => {
    // 'a' and 'я' and 'x' are 1 char → dropped; 'go' and 'os' are 2 chars → kept
    const { indices } = bm25Sparse('a я x go os');
    expect(indices).toEqual([tokenId('go'), tokenId('os')]);
  });

  it('returns an empty sparse vector for a stop-word-and-short-only query', () => {
    // 'is' and 'an' are stop words; 'a' is a 1-char token → all dropped.
    // (NB: 'it' is NOT in the stop-word set, so 'is it' would retain 'it' —
    // a divergence from retrieval-spec §4 #10, recorded as a finding.)
    expect(bm25Sparse('is a an')).toEqual({ indices: [], values: [] });
  });

  it('returns an empty sparse vector for a Russian stop-word-only query', () => {
    expect(bm25Sparse('и в на')).toEqual({ indices: [], values: [] });
  });

  it('treats differently-cased spellings of the same word as one index', () => {
    const upper = bm25Sparse('MongoDB');
    const lower = bm25Sparse('mongodb');
    expect(upper.indices).toEqual([tokenId('mongodb')]);
    expect(upper.indices).toEqual(lower.indices);
  });

  it('folds mixed casing of a repeated word into a single index with frequency 2', () => {
    const { indices, values } = bm25Sparse('MongoDB mongodb');
    expect(indices).toEqual([tokenId('mongodb')]);
    expect(values).toEqual([2]);
  });

  it('strips punctuation so only letters and digits remain in tokens', () => {
    // 'fail-over' splits into 'fail' and 'over' once the hyphen becomes a space;
    // trailing comma/bang are stripped and do not create stray tokens.
    const { indices } = bm25Sparse('fail-over, checkout!');
    expect(indices).toEqual([
      tokenId('fail'),
      tokenId('over'),
      tokenId('checkout'),
    ]);
  });

  it('keeps alphanumeric tokens such as the digit-bearing word "m3" intact', () => {
    // 'bge' (3 chars) and 'm3' (2 chars, kept at the >=2 boundary) and 'reranker'
    // all survive; the digit inside 'm3' is a \p{N} char, not stripped.
    const { indices } = bm25Sparse('bge m3 reranker');
    expect(indices).toEqual([
      tokenId('bge'),
      tokenId('m3'),
      tokenId('reranker'),
    ]);
  });
});

// Exhaustive stop-word coverage. Each multi-character stop word, on its own, must
// tokenize to an empty sparse vector — it is dropped for being a stop word, not
// for being too short (all entries here are length >= 2). This pins every
// individual entry of the STOP_WORDS set: if any one were removed from the set,
// that word would survive tokenization and the corresponding case would fail.
//
// One-character stop words ('a', and Russian 'и','в','с','к','у','о','а') are
// intentionally omitted: they are already dropped by the length >= 2 rule, so
// their stop-word membership is unobservable through bm25Sparse (equivalent
// mutants). Likewise the whitespace-split regex is robust to empty-token
// mutations because the length >= 2 filter discards empty strings.
describe('bm25Sparse stop-word set (exhaustive, length >= 2)', () => {
  const MULTI_CHAR_STOP_WORDS = [
    // English
    'the', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
    'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'this', 'that',
    // Russian
    'не', 'на', 'что', 'это', 'по', 'за', 'из', 'но', 'для', 'как', 'если', 'или',
    'же', 'вы', 'мы', 'он', 'она', 'они',
  ];

  it.each(MULTI_CHAR_STOP_WORDS)('drops the stop word "%s" to an empty sparse vector', (word) => {
    expect(bm25Sparse(word)).toEqual({ indices: [], values: [] });
  });

  it('still indexes a content word sitting next to many stop words', () => {
    // Sanity guard so the suite above cannot pass by bm25Sparse always returning
    // empty: a real token among stop words must survive with frequency 1.
    expect(bm25Sparse('the failover is on the checkout')).toEqual({
      indices: [tokenId('failover'), tokenId('checkout')],
      values: [1, 1],
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOP_K,
  resolveTopK,
  buildFilter,
  snippet,
  mapHits,
  type RawHit,
} from '../src/logic';

describe('DEFAULT_TOP_K', () => {
  it('is_five', () => {
    expect(DEFAULT_TOP_K).toBe(5);
  });
});

describe('resolveTopK', () => {
  it('defaults_to_five_when_undefined', () => {
    expect(resolveTopK(undefined)).toEqual({ ok: true, value: 5 });
  });

  it('accepts_lower_boundary_one', () => {
    expect(resolveTopK(1)).toEqual({ ok: true, value: 1 });
  });

  it('accepts_mid_range_value', () => {
    expect(resolveTopK(5)).toEqual({ ok: true, value: 5 });
  });

  it('accepts_upper_boundary_twenty', () => {
    expect(resolveTopK(20)).toEqual({ ok: true, value: 20 });
  });

  it('rejects_zero_with_exact_message', () => {
    const result = resolveTopK(0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection for top_k = 0');
    expect(result.message).toBe('top_k must be an integer in [1, 20]. Received: 0.');
  });

  it('rejects_twenty_one_with_exact_message', () => {
    const result = resolveTopK(21);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection for top_k = 21');
    expect(result.message).toBe('top_k must be an integer in [1, 20]. Received: 21.');
  });

  it('rejects_non_integer_with_exact_message', () => {
    const result = resolveTopK(2.5);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection for top_k = 2.5');
    expect(result.message).toBe('top_k must be an integer in [1, 20]. Received: 2.5.');
  });

  it('ok_discriminant_carries_value_not_message', () => {
    const result = resolveTopK(12);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected acceptance for top_k = 12');
    expect(result.value).toBe(12);
    expect('message' in result).toBe(false);
  });
});

describe('buildFilter', () => {
  it('returns_undefined_when_no_filters_given', () => {
    expect(buildFilter(undefined, undefined)).toBeUndefined();
  });

  it('builds_single_type_clause_when_only_type_given', () => {
    expect(buildFilter('adr', undefined)).toEqual({
      must: [{ key: 'type', match: { value: 'adr' } }],
    });
  });

  it('builds_single_source_file_clause_when_only_source_file_given', () => {
    expect(buildFilter(undefined, 'adr/0007-db-choice.md')).toEqual({
      must: [{ key: 'source_file', match: { value: 'adr/0007-db-choice.md' } }],
    });
  });

  it('builds_two_clause_must_array_in_type_then_source_file_order', () => {
    const filter = buildFilter('analysis', 'docs/specs/retrieval-spec.md');
    expect(filter).toEqual({
      must: [
        { key: 'type', match: { value: 'analysis' } },
        { key: 'source_file', match: { value: 'docs/specs/retrieval-spec.md' } },
      ],
    });
    // Order is load-bearing: type precedes source_file.
    expect(filter!.must[0].key).toBe('type');
    expect(filter!.must[1].key).toBe('source_file');
  });

  it('treats_empty_string_type_as_absent', () => {
    expect(buildFilter('', 'api/orders.md')).toEqual({
      must: [{ key: 'source_file', match: { value: 'api/orders.md' } }],
    });
  });
});

describe('snippet', () => {
  it('returns_empty_string_for_undefined', () => {
    expect(snippet(undefined)).toBe('');
  });

  it('returns_empty_string_for_empty_input', () => {
    expect(snippet('')).toBe('');
  });

  it('collapses_runs_of_whitespace_newlines_and_tabs_to_single_spaces', () => {
    expect(snippet('Order   total\t\tincludes\n\ntax  and shipping')).toBe(
      'Order total includes tax and shipping',
    );
  });

  it('trims_leading_and_trailing_whitespace', () => {
    expect(snippet('   \n  Payment captured on authorization.  \t ')).toBe(
      'Payment captured on authorization.',
    );
  });

  it('truncates_to_exactly_200_chars_with_correct_boundary_content', () => {
    // 260-char realistic doc paragraph; assert the slice is exactly 200 chars
    // and that char 199 is kept while char 200 is dropped.
    const body =
      'The Qdrant collection proshop_docs stores 1024 dimensional dense vectors produced by the bge-m3 embedding model, and the search-docs MCP tool runs a cosine similarity search returning the top matching documentation chunks for any query.';
    expect(body.length).toBeGreaterThan(200);
    const result = snippet(body);
    expect(result.length).toBe(200);
    expect(result).toBe(body.slice(0, 200));
    // Boundary: 200th char (index 199) retained, 201st (index 200) excluded.
    expect(result[199]).toBe(body[199]);
    expect(result.endsWith(body.slice(0, 201))).toBe(false);
  });

  it('collapses_whitespace_before_truncating_so_length_reflects_compacted_text', () => {
    // 200 'a' chars + a run of spaces + tail; after collapse it is one space,
    // so the result is exactly 200 chars of leading text (tail cut off).
    const text = 'a'.repeat(200) + '          tail-after-the-gap';
    const result = snippet(text);
    expect(result.length).toBe(200);
    expect(result).toBe('a'.repeat(200));
  });
});

describe('mapHits', () => {
  const fullHit: RawHit = {
    score: 0.8731,
    payload: {
      source_file: 'adr/0007-db-choice.md',
      file_path: 'docs/adr/0007-db-choice.md',
      title: 'ADR 0007: Choose MongoDB for the catalog store',
      parent_headings: ['Architecture Decisions', 'Data Layer'],
      text: 'We selected MongoDB because the product catalog is document shaped.',
      type: 'adr',
      keywords: ['mongodb', 'catalog'],
    },
  };

  it('maps_all_payload_fields_through_to_output_shape', () => {
    expect(mapHits([fullHit])).toEqual([
      {
        source_file: 'adr/0007-db-choice.md',
        file_path: 'docs/adr/0007-db-choice.md',
        title: 'ADR 0007: Choose MongoDB for the catalog store',
        parent_headings: ['Architecture Decisions', 'Data Layer'],
        score: 0.8731,
        snippet: 'We selected MongoDB because the product catalog is document shaped.',
      },
    ]);
  });

  it('preserves_exact_score_value', () => {
    const [hit] = mapHits([{ score: 0.4215, payload: fullHit.payload }]);
    expect(hit.score).toBe(0.4215);
  });

  it('defaults_missing_string_fields_to_empty_string_not_undefined', () => {
    const [hit] = mapHits([
      { score: 0.51, payload: { parent_headings: ['Heading Only'] } },
    ]);
    expect(hit.source_file).toBe('');
    expect(hit.file_path).toBe('');
    expect(hit.title).toBe('');
    expect(hit.snippet).toBe('');
    expect(hit.parent_headings).toEqual(['Heading Only']);
  });

  it('defaults_missing_parent_headings_to_empty_array_not_undefined', () => {
    const [hit] = mapHits([
      { score: 0.62, payload: { source_file: 'api/orders.md', title: 'Orders API' } },
    ]);
    expect(hit.parent_headings).toEqual([]);
  });

  it('defaults_every_field_when_payload_is_null', () => {
    const [hit] = mapHits([{ score: 0.99, payload: null }]);
    expect(hit).toEqual({
      source_file: '',
      file_path: '',
      title: '',
      parent_headings: [],
      score: 0.99,
      snippet: '',
    });
  });

  it('defaults_every_field_when_payload_is_undefined', () => {
    const [hit] = mapHits([{ score: 0.12 }]);
    expect(hit).toEqual({
      source_file: '',
      file_path: '',
      title: '',
      parent_headings: [],
      score: 0.12,
      snippet: '',
    });
  });

  it('runs_text_through_snippet_collapsing_whitespace', () => {
    const [hit] = mapHits([
      {
        score: 0.7,
        payload: { text: 'Checkout\n\nrequires   a\tvalid payment method.' },
      },
    ]);
    expect(hit.snippet).toBe('Checkout requires a valid payment method.');
  });

  it('runs_text_through_snippet_truncating_long_text_to_200_chars', () => {
    const longText =
      'The search-docs MCP server exposes one tool named search_project_docs which accepts a free text query plus an optional top_k and payload filters, then returns the most relevant documentation chunks ranked by cosine similarity against the dense vectors.';
    expect(longText.length).toBeGreaterThan(200);
    const [hit] = mapHits([{ score: 0.66, payload: { text: longText } }]);
    expect(hit.snippet.length).toBe(200);
    expect(hit.snippet).toBe(longText.slice(0, 200));
  });

  it('maps_multiple_hits_preserving_input_order', () => {
    const hits = mapHits([
      { score: 0.9, payload: { source_file: 'adr/0001-first.md', title: 'First' } },
      { score: 0.3, payload: { source_file: 'adr/0002-second.md', title: 'Second' } },
    ]);
    expect(hits.map((h) => h.source_file)).toEqual([
      'adr/0001-first.md',
      'adr/0002-second.md',
    ]);
    expect(hits.map((h) => h.score)).toEqual([0.9, 0.3]);
  });

  it('returns_empty_array_for_empty_input', () => {
    expect(mapHits([])).toEqual([]);
  });
});

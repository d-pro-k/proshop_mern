# Stage 4 — Tests Agent

A dedicated test-writing sub-agent (`test-writer-mate`, a pure write-agent that
adds tests but never edits production code) generated strong unit tests for the
project's three first-party services, which were then run under Vitest and
hardened with Stryker mutation testing to a mutation score (MSI) above 70% on
each service.

The three services covered:

| # | Service | Module under test | Test file |
|---|---------|-------------------|-----------|
| 1 | feature-flags MCP (`mcp/feature-flags`) | `src/logic.ts` | `service-1-tests/logic.test.ts` |
| 2 | search-docs MCP (`mcp/search-docs`) | `src/logic.ts` | `service-2-tests/logic.test.ts` |
| 3 | rag (`rag/`) | `bm25.ts` | `service-3-tests/bm25.test.ts` |

(The brief asks for two services; three are covered.)

## Testability refactor (prerequisite)

The two MCP entry points (`mcp/feature-flags/src/index.ts`,
`mcp/search-docs/src/index.ts`) exported nothing and executed
`await server.connect(transport)` at module top level, so they could not be
imported into a test process, and their bodies are mostly large tool-description
string literals that mutation testing cannot meaningfully exercise.

Each service's pure, side-effect-free decision logic was therefore extracted
into a new importable `src/logic.ts`, leaving `index.ts` as a thin wrapper that
owns I/O (file reads/writes, Ollama/Qdrant calls) and server wiring and delegates
every decision to `logic.ts`. The change is behaviour-preserving (the services
build cleanly and their tool outputs are unchanged) and lets both unit tests and
mutation testing target the logic directly. Mutation scope (`stryker.conf.json`)
and coverage scope (`vitest.config.ts`) are pinned to those logic modules.

For `rag/`, `bm25.ts` was already a pure exported module and needed no
refactor; the other `rag/` modules (`hybrid.ts`, `hybrid-rerank.ts`,
`rerank.ts`, `query.ts`, `ingest*.ts`) require a live Qdrant instance, an Ollama
embedding server, and a Python reranker venv, so they are integration-only and
out of scope for the offline unit/mutation suite.

## Results

### Test counts (Vitest, all green)

| Service | Tests | Statement / branch / function / line coverage of the logic module |
|---------|-------|------------------|
| feature-flags | 45 | 100% / 100% / 100% / 100% |
| search-docs | 31 | 100% / 100% / 100% / 100% |
| rag | 73 | 100% / 100% / 100% / 100% |

### Mutation score (Stryker)

| Service | Baseline MSI | Final MSI | Target | Survivors (final) |
|---------|-------------:|----------:|:------:|-------------------|
| feature-flags | 99.26% | 99.26% | > 70% | 1 — equivalent mutant |
| search-docs | 100.00% | 100.00% | > 70% | 0 |
| rag | 40.22% | 90.22% | > 70% | 9 — all equivalent mutants |

The raw baseline and final Stryker numbers for all three services are in
`starting_msi.txt` and `final_msi.txt`, including a per-service breakdown of the
remaining survivors.

Only `rag/bm25.ts` needed a strengthening pass: its baseline left individual
`STOP_WORDS` entries unpinned. One parametrised test asserting that every
multi-character stop word tokenises to an empty vector raised the score from
40.22% to 90.22%. The remaining survivors on all services are equivalent
mutants (documented per service) that no test can kill without changing
production code.

## A finding surfaced while writing tests

The retrieval reverse-engineering spec states that the query `"is it"` yields an
empty BM25 sparse vector. In the actual `STOP_WORDS` set, `is` is a stop word but
`it` is **not**, so `"is it"` retains `it` and produces a non-empty vector. The
test was written against the real behaviour, and the divergence is noted inline
in `service-3-tests/bm25.test.ts`. This is a documentation/code mismatch worth a
follow-up (either add `it` to the stop list or correct the spec example).

## How to reproduce

From each service directory (`mcp/feature-flags`, `mcp/search-docs`, `rag`):

```bash
npm install              # first time, to pull the test toolchain
npx vitest run           # run the unit tests
npx vitest run --coverage  # tests + coverage summary  (captured in coverage-report.md)
npx stryker run          # mutation testing; HTML report at reports/mutation/mutation.html
```

`coverage-report.md` captures the `vitest run --coverage` output across the three
services (full runner output plus a summary table).

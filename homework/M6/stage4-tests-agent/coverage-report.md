# Coverage Report — Stage 4 Tests

Captured from a live run of `npx vitest run --coverage` in each of the three
services. All suites pass and the unit-/mutation-tested logic modules report
100% statement, branch, function, and line coverage.

```bash
for d in mcp/feature-flags mcp/search-docs rag; do (cd "$d" && npx vitest run --coverage); done
```

## Summary

| Service | Test files | Tests | Stmts | Branch | Funcs | Lines |
|---------|:----------:|:-----:|:-----:|:------:|:-----:|:-----:|
| feature-flags MCP (`mcp/feature-flags`) | 2 passed | 45 passed | 100% | 100% | 100% | 100% |
| search-docs MCP (`mcp/search-docs`) | 2 passed | 31 passed | 100% | 100% | 100% | 100% |
| rag (`rag/`) | 2 passed | 73 passed | 100% | 100% | 100% | 100% |

Coverage is scoped (in each `vitest.config.ts`) to the pure logic module that the
unit and mutation suites target — `src/logic.ts` for the two MCP servers and
`bm25.ts` for rag. The thin I/O/stdio wrappers and the network/subprocess
retrieval modules are integration-only and excluded from the unit-coverage scope.

## Full output

### feature-flags MCP (`mcp/feature-flags`)

```
 RUN  v4.1.8 proshop_mern/mcp/feature-flags
      Coverage enabled with v8

 ✓ test/smoke.test.ts (1 test) 2ms
 ✓ test/logic.test.ts (44 tests) 5ms

 Test Files  2 passed (2)
      Tests  45 passed (45)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 logic.ts |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
```

### search-docs MCP (`mcp/search-docs`)

```
 RUN  v4.1.8 proshop_mern/mcp/search-docs
      Coverage enabled with v8

 ✓ test/smoke.test.ts (1 test) 2ms
 ✓ test/logic.test.ts (30 tests) 4ms

 Test Files  2 passed (2)
      Tests  31 passed (31)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 logic.ts |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
```

### rag (`rag/`)

```
 RUN  v4.1.8 proshop_mern/rag
      Coverage enabled with v8

 ✓ test/smoke.test.ts (1 test) 2ms
 ✓ test/bm25.test.ts (72 tests) 6ms

 Test Files  2 passed (2)
      Tests  73 passed (73)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 bm25.ts  |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
```

> Mutation testing (Stryker) is reported separately in `starting_msi.txt` and
> `final_msi.txt`: final MSI 99.26% / 100% / 90.22% — all above the 70% target.

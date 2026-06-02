# 0005: Store Feature Flags as a JSON File with the MCP Server as Canonical Writer

## Status

Accepted (inferred from current implementation) — write-path enforcement is partial (see Consequences).

## Context

Feature flags live in `backend/features.json` (~25 flags, ~14KB), separate from the MongoDB the rest of the domain uses. Three components touch them:

- The `feature-flags` MCP server (`mcp/feature-flags/src/index.ts`) owns the write path. It performs validation (status enum, traffic-rollout canonicalization, dependency warnings) and writes atomically via a temporary-file-plus-rename.
- The Express `featureFlagController` (`backend/controllers/featureFlagController.js`) reads and re-parses the same file to expose read-only HTTP endpoints.
- The frontend consumes those endpoints in two different ways: a Redux-based screen (`frontend/src/screens/DashboardFeaturesScreen.js`) and a raw-fetch hook screen (`frontend/src/screens/admin/FeatureFlagsScreen.jsx` with `frontend/src/screens/admin/hooks/useFeatures.js`).

`AGENTS.md` already states the operating rule: changes to flag state go through the MCP tools, and `backend/features.json` is never edited directly. No ADR yet records that a flat file (not MongoDB) is the flag store, nor that the MCP server is the authoritative writer.

## Decision Drivers

- Flags are few (~25) and benefit from a simple, diffable, human-readable store.
- A single authoritative writer avoids concurrent-write corruption of a flat file.
- The MCP server already centralizes flag schema, validation, and atomic writes.

## Decision

Treat `backend/features.json` as the canonical feature-flag store for this legacy fork, with the **`feature-flags` MCP server as the sole writer** and the backend as a read-only consumer. Flag schema, validation, and writes belong in the MCP server's access path; HTTP and UI consumers read the resulting state and never write the file directly.

Future read consumers (backend and frontend) should converge on one shared access/schema module with in-memory caching invalidated on write, rather than independently re-reading and re-parsing the file.

## Alternatives

- Store flags in MongoDB like the rest of the domain — rejected for now: heavier for ~25 flags and breaks the MCP's simple file-edit model; revisit if flags grow or need per-environment values.
- Let the backend write flags too — rejected: reintroduces the dual-owner race this decision exists to prevent.

## Consequences

- One simple, version-controlled source of truth for the flag contract; atomic writes prevent partial-file corruption.
- **Partial enforcement (current state):** the backend controller re-reads and re-parses `backend/features.json` on every request, uncached, so the "single access module" half of this decision is not yet realized (noted in `homework/M6/stage1-code-review/synthesis.md`).
- **Open security/perf item:** the HTTP read endpoints' authentication and the uncached per-request parse remain concerns until the shared access module and access policy are finalized.
- **Client duplication:** two contradictory consumption patterns exist on the frontend; consolidating them is follow-up work (see the feature-flags spec under `docs/specs/`).
- A flat file gives no multi-writer safety beyond atomic rename and no horizontal scaling; flag writes are not transactional with MongoDB data.

## Confidence

MEDIUM — the file-as-store and MCP-as-writer decisions are implemented and documented as an operating rule; the single-access-module consolidation is still open.

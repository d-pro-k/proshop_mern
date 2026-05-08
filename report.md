# M2 — Report

## IDE

- Primary IDE: Codex CLI.
- Rules file: `AGENTS.md`.

## Rules diff

- Added the local port rule: this fork uses backend `PORT=5001` and CRA proxy `http://127.0.0.1:5001` because port `5000` is occupied on macOS.
- Added the Node/OpenSSL startup note for the legacy CRA stack: `NODE_OPTIONS=--openssl-legacy-provider npm run client`.
- Added repo-specific guardrails: keep backend ESM imports explicit with `.js`, do not touch Heroku deployment files casually, and isolate dependency upgrades from bugfixes.
- Added seed-data guidance after model or required-field changes so local onboarding remains repeatable.

## Local startup

I ran the project locally with Docker MongoDB, imported seed data, started the backend on `http://localhost:5001`, and started the frontend on `http://localhost:3000`. I verified product loading, frontend proxy calls, PayPal config loading, seeded admin login, and authenticated order creation.

## 3 questions

- Manual estimate: about 6-8 hours to inspect the legacy app, run it, document startup, audit findings, fix one issue, and add the optional docs/tests.
- Most useful IDE feature: fast repo-wide search and iterative patching with command verification. It made it practical to keep docs, findings, and runtime notes tied to actual code instead of assumptions.
- Where AI/runtime assumptions failed: the original setup assumed port `5000` and a plain frontend start. Local verification showed `5000` was occupied and CRA failed on modern Node without the OpenSSL legacy provider, so I aligned the fork on `5001` and documented the workaround.

## NICE-TO-HAVE and EXTRA

- Added `docs/architecture.md` with a Mermaid architecture diagram.
- Added three ADRs under `docs/adr/`.
- Added characterization tests under `experiments/characterization/`.
- Added `docker-compose.yml` and README usage notes.
- Upgraded Mongoose from `5.10.6` to `8.22.1`, adjusted removed APIs/options, and verified seed, backend startup, product/user delete flows, and order creation.

---

# M3 — Report

## IDE

- Primary IDE: Claude Code (claude-sonnet-4-6).
- MCP config: `.mcp.json` in the repo root.

## Feature flags MCP

**Scenario:** check the state of feature `search_v2`, promote to `Testing` if it is `Disabled`, then set traffic rollout to 25%.

### Tool call 1 — `get_feature_info`

**Request:**
```json
{ "feature_id": "search_v2" }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline. Improves relevance for multi-word queries and handles common misspellings via fuzzy matching. Backend: new productController search path; index built on name, brand, category, description fields.",
  "status": "Testing",
  "traffic_percentage": 15,
  "last_modified": "2026-03-10",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary"
}
```

**Decision:** feature is already in `Testing` at 15% traffic — `set_feature_state` is not needed; proceeding directly to `adjust_traffic_rollout`.

### Tool call 2 — `adjust_traffic_rollout`

**Request:**
```json
{ "feature_id": "search_v2", "percentage": 25 }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-08",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "hint": null
}
```

**Result:** rollout set to 25%; `last_modified` updated to `2026-05-08` (UTC).

### Tool call 3 — `get_feature_info` (confirmation)

**Request:**
```json
{ "feature_id": "search_v2" }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-08",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary"
}
```

**Summary:** `search_v2` — `status: Testing`, `traffic_percentage: 25`, `last_modified: 2026-05-08`. Scenario completed without manual intervention.

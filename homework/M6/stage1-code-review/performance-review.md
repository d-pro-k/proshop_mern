# Performance Review — ProShop MERN Fork (Stage 1 Code Review)

**Reviewer role:** Senior Performance Engineer (read-only, static review — no benchmarks run)
**Scope:** Whole fork — `backend/` (Express/Mongoose API, controllers, models, middleware, `server.js`, `seeder.js`), `frontend/src/` (React/Redux SPA — bundle + render + data fetching), `mcp/feature-flags/src`, `mcp/search-docs/src`, and `rag/` (Qdrant ingest/query/hybrid/rerank pipeline).
**Out of scope:** `node_modules/`, `dist/`, `frontend/build/`, tests, `scripts/`, `frontend/public/`, `qdrant_storage/`, `uploads/`, `experiments/`, `assignments/`.
**Method:** Manual source walk of in-scope files, focused on the known hot paths: `GET /api/products` (list + keyword search + pagination), `GET /api/orders/myorders` and order detail, the feature-flags read endpoints, and the RAG `query`/`hybrid` retrieval path. Estimates are analytical (Big-O + typical per-op costs), not measured; treat absolute numbers as order-of-magnitude.
**Estimates are quantified where the cost model is clear, and marked qualitative otherwise.**

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 4     |
| MEDIUM   | 3     |
| LOW      | 2     |
| **Total**| **9** |

**Top concern (N+1 / blocking I/O / memory):** **PERF-03** — the public, unauthenticated feature-flags endpoints read and `JSON.parse` `features.json` (~14KB) from disk on **every** request with no caching. This is both a repeated blocking-I/O + synchronous-parse cost on the event loop and an amplification vector on an endpoint that should not even be public (cross-ref SEC-04). The same uncached read-per-call pattern repeats inside the feature-flags MCP server.

**Cross-references to the security review:** PERF-02 ↔ SEC-05 (regex product search), PERF-03 ↔ SEC-04 (feature-flags endpoint is public), PERF-05 ↔ SEC-14 (no body-size cap). These are not duplicated below — the performance angle is described and the SEC-id is cited.

---

## HIGH

### PERF-01 — No index on `order.user`; `getMyOrders` is a full collection scan
`backend/models/orderModel.js:5` / `backend/controllers/orderController.js:158`. `Order.find({ user: req.user._id })` runs on a hot, authenticated path, but `orderModel.js` declares no index on `user`. Every call is a COLLSCAN.
**Estimated impact:** ~50-300ms p95 at ~10k orders, scaling linearly to +500ms-2s at 1M docs, vs <2ms with an index.
**Fix:** `orderSchema.index({ user: 1, createdAt: -1 })` — also covers chronological sort and the admin list.

### PERF-02 — Keyword product search: unindexed `$regex`, two full scans per request
`backend/controllers/productController.js:20-23`. The keyword branch builds `{ name: { $regex, $options:'i' } }` and runs it through both `countDocuments` and `find`. There is no index on `name`, and an unanchored case-insensitive regex cannot use a btree index regardless.
**Estimated impact:** Two full scans + a per-document regex evaluation per request; ~100-400ms p95 at 50k products, CPU-bound on the event loop. **Cross-ref SEC-05** — a crafted keyword turns this into catastrophic backtracking (ReDoS), so the perf and security risks compound.
**Fix:** MongoDB `$text` index on `name`(+`description`) and `$text`/`$search`; or anchor + escape the regex and cap keyword length.

### PERF-03 — feature-flags endpoints read + parse `features.json` on every request (no cache)
`backend/controllers/featureFlagController.js:9-12` (and the feature-flags MCP server, `mcp/feature-flags/src/index.ts:31`, which re-reads on every tool call). `readFeatures()` does `readFile` + `JSON.parse` of ~14KB per call. The API routes are public/unauthenticated (`backend/server.js:31`).
**Estimated impact:** Per request = one filesystem syscall + a synchronous ~14KB parse (~0.2-0.5ms event-loop block). On a public endpoint this is free amplification: 1k req/s ≈ 1k disk reads/s and ~200-500ms/s of blocked event loop.
**Fix:** Load once at module init, cache in memory, invalidate on the write path (the MCP server owns writes) or via `fs.watch`; add `Cache-Control`/`ETag`. **Cross-ref SEC-04** — the endpoint should be protected, not public.

### PERF-04 — Unpaginated list endpoints return entire collections (unbounded payload + memory)
`backend/controllers/orderController.js:165-166` (`Order.find({}).populate(...)`), `:157-158` (`getMyOrders`), `backend/controllers/userController.js:110-111` (`User.find({})`). None apply `limit`/`skip`, unlike `getProducts` which already paginates.
**Estimated impact:** Response and heap grow O(collection). At 100k orders, each row embeds an `orderItems` array → multi-MB JSON serialized synchronously (blocks the event loop tens of ms) and fully buffered in the Node heap (+50-200MB transient). p95 degrades without bound; OOM risk under admin load.
**Fix:** Reuse the existing `getProducts` pagination pattern; `.limit()` + field projection; return `{ items, page, pages }`.

---

## MEDIUM

### PERF-05 — `express.json()` with no size limit (synchronous parse of large bodies)
`backend/server.js:25`. `app.use(express.json())` applies globally with no explicit `limit`. Large bodies are buffered and parsed synchronously on the event loop; `addOrderItems` then maps over a client-supplied `orderItems` array with no length cap (`orderController.js:57`).
**Estimated impact:** A large/crafted body forces a synchronous parse that stalls all concurrent requests for the parse duration (tens of ms at 100% CPU); an oversized `orderItems` array multiplies downstream cost. **Cross-ref SEC-14** (missing body-size cap / DoS).
**Fix:** `express.json({ limit: '16kb' })` (tune per route); validate `orderItems.length` before the map.

### PERF-06 — Frontend ships one un-split bundle (admin + PayPal + devtools to every shopper)
`frontend/src/App.js:6-22` eagerly imports all 18 route screens including the admin dashboard and feature-flags table; `frontend/src/store.js:3` imports `composeWithDevTools` unconditionally; the PayPal wrapper is pulled in eagerly via `OrderScreen`. CRA `3.4.3` has weak tree-shaking.
**Estimated impact:** First-paint bundle carries admin-only and payment code a typical shopper never loads → roughly +150-300KB gzipped → +300-600ms LCP on a mid-mobile/3G connection. redux-devtools glue also ships to production.
**Fix:** `React.lazy`/`Suspense` per route (at minimum `/admin/*` and the PayPal button); guard `composeWithDevTools` behind `NODE_ENV !== 'production'`; load the PayPal SDK only when checkout reaches payment.

### PERF-07 — Reranker spawns a fresh Python process (cold model load) per query
`rag/rerank.ts:19` / `rag/hybrid-rerank.ts:48`. `rerank()` does `spawn(PYTHON_BIN, [RERANK_SCRIPT])` inside the per-query promise, so the cross-encoder model is cold-loaded on every reranked query.
**Estimated impact:** Each reranked query pays Python startup + model load (typically 0.5-3s cold for a sentence-transformers cross-encoder) on top of embed + Qdrant retrieve. The reranked-path p95 is dominated by this cold start, not the scoring; throughput is effectively serialized on process spawns.
**Fix:** Run `rerank.py` as a long-lived worker/loopback service that loads the model once and streams queries; reuse across calls with bounded concurrency.

---

## LOW

### PERF-08 — `getTopProducts` recomputes an unindexed sort on every homepage load
`backend/controllers/productController.js:154-156`. `Product.find({}).sort({ rating: -1 }).limit(3)` runs with no index on `rating`; `HomeScreen` fires it on every default-mode mount. The result is near-static.
**Estimated impact:** Collection scan + top-k sort per call (~5-30ms) for a value that changes only when reviews change.
**Fix:** Index `rating` (`-1`) and cache the top-3 in memory with a short TTL, or precompute on review write.

### PERF-09 — `createProductReview` re-reduces and rewrites the whole embedded reviews array
`backend/controllers/productController.js:137-143`. Each new review recomputes `numReviews` and the rating average by reducing the entire `reviews` array, then `product.save()` rewrites the whole document; embedded reviews are also returned unprojected by `getProductById`.
**Estimated impact:** O(n) CPU + a full-document rewrite per review; for a product with thousands of embedded reviews each write loads and re-serializes the whole subarray, and every product-detail response carries the full (unbounded) reviews array.
**Fix:** Maintain a running average incrementally and use `$push`/`$inc` atomic updates; consider a separate paginated reviews collection if counts grow.

---

## Coverage notes

- **N+1 / per-item awaits:** No classic ORM-in-a-loop N+1 found. `addOrderItems` (`orderController.js:43`) already batches product lookups via a single `$in` query + a `Map` — good. The closest hot-path concern is PERF-09 (O(n) embedded-array rewrite per review).
- **Blocking I/O on the event loop:** PERF-03 (read+parse per request), PERF-05 (unbounded sync JSON parse). The RAG/MCP `embed` + `qdrant.search` calls are correctly `await`ed network I/O (non-blocking); the inherent embed→search sequence is data-dependent and not parallelizable.
- **Memory / unbounded growth:** PERF-04 (whole-collection responses), PERF-09 (unbounded embedded reviews).
- **Missing indexes:** PERF-01 (`order.user`), PERF-02 (`product.name`), PERF-08 (`product.rating`). The fork ships zero schema indexes beyond the implicit `_id` and the `email` unique index on users.
- **Caching:** PERF-03, PERF-08 are the clear repeated-recomputation wins.
- **RAG ingest (`ingest.ts` / `ingest-hybrid.ts`):** these are one-shot batch jobs (out of the request hot path) and already batch embeddings with `Promise.all` over `BATCH_SIZE=16` and stream-read `chunks.jsonl` line-by-line — appropriate; not flagged.
- **Cross-referenced security findings (not duplicated):** SEC-05 (PERF-02), SEC-04 (PERF-03), SEC-14 (PERF-05).

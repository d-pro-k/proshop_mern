# Security Review — ProShop MERN Fork (Stage 1 Code Review)

**Reviewer role:** Senior Security Auditor (read-only review)
**Scope:** Whole fork — `backend/` (Express/Mongoose API, auth, uploads, feature-flags), `frontend/src/` (React/Redux SPA), `mcp/feature-flags` + `mcp/search-docs` (MCP servers), `rag/` (Qdrant ingest/query pipeline), and root config (`docker-compose.yml`, `Procfile`, `package.json`, CI workflow).
**Out of scope:** `node_modules/`, build output, tests, `scripts/`, `uploads/`, `qdrant_storage/`, `experiments/`, `assignments/`.
**Method:** Manual source walk of all in-scope files + `npm audit`. Findings are evidence-based with `file:line`.

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 6     |
| MEDIUM   | 9     |
| LOW      | 3     |
| **Total**| **18**|

**Most critical issue:** Broken access control on orders — `getOrderById` and `updateOrderToPaid` (`backend/controllers/orderController.js`) enforce no ownership check. Any authenticated user can read any other customer's order (IDOR, including shipping address + PayPal payer email) and can mark **any** order as paid with client-fabricated payment data, fully bypassing payment.

---

## HIGH

### SEC-01 — IDOR on `GET /api/orders/:id`
`backend/controllers/orderController.js:96`. The route is behind `protect` only; the controller loads the order by id and returns it with no `order.user === req.user._id || req.user.isAdmin` check. Any logged-in user can enumerate ObjectIds and read other customers' orders (shipping address, PayPal payer email). **Fix:** reject with 403 unless the requester owns the order or is admin.

### SEC-02 — Payment bypass on `PUT /api/orders/:id/pay`
`backend/controllers/orderController.js:113`. Sets `isPaid = true` and stores `paymentResult` straight from `req.body` with no ownership check and no server-side verification against PayPal. Any authenticated user can mark any order paid with forged payment data. **Fix:** verify ownership/admin and verify the capture server-side against the PayPal API.

### SEC-03 — JWT verified without an algorithm allow-list on vulnerable `jsonwebtoken` 8.5.1
`backend/middleware/authMiddleware.js:15`. `jwt.verify(token, secret)` has no `{ algorithms: ['HS256'] }`. Combined with `jsonwebtoken <=8.5.1` advisories (GHSA-qwph-4952-7xr6 insecure default algorithm, GHSA-hjrf-2m68-5959 RSA→HMAC key confusion), this enables signature-bypass / token forgery. **Fix:** pin `algorithms`, upgrade to `jsonwebtoken@>=9`.

### SEC-04 — Feature-flags API is unauthenticated; admin guard is client-side only
`backend/server.js:31` + `backend/routes/featureFlagRoutes.js`. No `protect`/`admin` on `GET /api/feature-flags` and `/:featureId`. The only "admin guard" is a `useEffect` redirect in `FeatureFlagsScreen.jsx` (trivially bypassed by calling the API directly). Leaks rollout strategy, `targeted_segments`, and dependency topology to anonymous users. **Fix:** protect the read routes server-side / scope the payload.

### SEC-11 — Known-vulnerable backend dependencies (16 advisories: 1 critical, 10 high)
`package.json`. `npm audit` flags `jsonwebtoken<=8.5.1` (signature bypass), `multer<=2.1.0` via `dicer` (HeaderParser crash DoS — reachable from the public `/api/upload`), and `body-parser`/`qs` DoS, among others. **Fix:** upgrade `jsonwebtoken>=9` and `multer>=2.x`, re-run audit; isolate the upgrade per repo convention.

### SEC-12 — `react-scripts` pinned to 3.4.3 (2020)
`frontend/package.json`. Drags in years-old webpack/babel/postcss/node-forge transitive deps with many published advisories; already requires `--openssl-legacy-provider` to run on modern Node. **Fix:** plan an isolated CRA-toolchain upgrade (or build migration).

---

## MEDIUM

### SEC-05 — Regex injection / ReDoS in product search
`backend/controllers/productController.js:11`. `req.query.keyword` flows straight into `{ $regex: keyword, $options: 'i' }` on a public endpoint. A crafted keyword triggers catastrophic backtracking → CPU exhaustion. **Fix:** escape regex metacharacters or use a `$text` index; cap keyword length.

### SEC-06 — Hardcoded weak fallback `JWT_SECRET`
`docker-compose.yml:21` (`${JWT_SECRET:-replace_with_dev_secret}`), echoed in `.env.example` and `AGENTS.md`. Shipping without overriding makes all tokens forgeable with a publicly known key. No strength check exists in `generateToken.js`/`authMiddleware.js`. **Fix:** remove the inline fallback so the stack fails fast; require a strong random secret.

### SEC-07 — No rate limiting on auth endpoints
`backend/controllers/userController.js:8` / `userRoutes.js`. `POST /login` and `POST /` (register) allow unlimited attempts → credential stuffing / brute force / registration abuse. **Fix:** add `express-rate-limit` (e.g. 5–10 / 15 min per IP) on auth routes.

### SEC-08 — No server-side input validation / password policy
`backend/controllers/userController.js:30`. Email format is never validated and there is no minimum password strength (`123456` is accepted — see `data/users.js`). **Fix:** add `express-validator`/`Joi` for email, name length, and a password policy.

### SEC-09 — Mass-assignment on profile / admin user update
`backend/controllers/userController.js:82,147`. `updateUserProfile` lets a user change their email with no uniqueness re-check or verification (takeover risk). `updateUser` sets `user.isAdmin = req.body.isAdmin` unconditionally — omitting the field sets it `undefined` and silently demotes. **Fix:** whitelist and validate each updatable field.

### SEC-10 — Password pre-save hook re-hashes already-hashed passwords
`backend/models/userModel.js:34`. On the not-modified path it calls `next()` without `return`, falls through and re-bcrypts the stored hash, corrupting credentials on any user-document save that doesn't change the password (account lockout / auth availability). **Fix:** `return next()`.

### SEC-13 — Unsafe file upload (extension/MIME-only, no size limit, no auth)
`backend/routes/uploadRoutes.js:18`. Validation trusts client filename + spoofable `mimetype`; no `limits.fileSize` (disk-exhaustion DoS); and the route has **no `protect`/`admin`** — anyone can write files into `uploads/`. **Fix:** add size limits, magic-byte validation, randomised filenames, and require admin.

### SEC-14 — Missing security headers / CORS policy / body-size cap
`backend/server.js:25`. No `helmet` (HSTS, X-Content-Type-Options, CSP/frame-ancestors), no CORS config, no explicit JSON size limit. **Fix:** add `helmet`, explicit `express.json({ limit })`, and a global rate limiter.

### SEC-15 — Long-lived, non-revocable JWT stored in `localStorage`
`frontend/src/actions/userActions.js:53` + `backend/utils/generateToken.js`. 30-day token (per ADR-0003, not server-revocable) in `localStorage` is exfiltrable by any XSS or malicious CRA dependency. **Fix:** httpOnly+Secure+SameSite cookie, shorter lifetime, refresh rotation.

---

## LOW

### SEC-16 — No security audit logging; raw error dumps
`backend/middleware/authMiddleware.js:21`. Auth failures, admin actions (user delete, role change, feature-flag writes) and payment changes aren't audit-logged; `console.error(error)` dumps full stack traces. **Fix:** structured audit logging; avoid logging token internals.

### SEC-17 — SSRF surface via unvalidated service URLs in MCP/RAG
`mcp/search-docs/src/index.ts:24` (and the `rag/*` embed helpers). `OLLAMA_URL`/`QDRANT_URL` are taken from env with no allow-list; user query text is forwarded to whatever host they name. **Fix:** pin to a fixed host allow-list and validate scheme/host before requesting.

### SEC-18 — `/api/config/paypal` echoes a raw env value unauthenticated
`backend/server.js:33`. `res.send(process.env.PAYPAL_CLIENT_ID)` with no presence/type check; a misconfigured env could leak an unintended secret, and an empty value yields a confusing response. **Fix:** validate and return typed JSON.

---

## Coverage notes

- OWASP A01–A10 all scanned. No `dangerouslySetInnerHTML`/`eval` found in `frontend/src` (XSS surface limited to the token-in-localStorage exposure, SEC-15).
- Dependency audit run on the backend tree (`npm audit`): 16 advisories (1 critical, 10 high) — see SEC-11/SEC-12.
- No `.env` or live secrets committed (`.env.example` only); the weak shared default secret (SEC-06) is the main secrets concern.
- The bcrypt password-hashing approach itself is sound (genSalt 10), but the pre-save control-flow bug (SEC-10) undermines it.

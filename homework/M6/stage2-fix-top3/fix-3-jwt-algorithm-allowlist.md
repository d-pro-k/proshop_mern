# Fix 3 — Pin JWT verification to HS256 (SEC-03)

## 1. Original finding

> **SEC-03 — JWT verified without an algorithm allow-list on vulnerable `jsonwebtoken` 8.5.1** (HIGH)
> `backend/middleware/authMiddleware.js:15`. `jwt.verify(token, secret)` has no `{ algorithms: ['HS256'] }`. Combined with `jsonwebtoken <=8.5.1` advisories (GHSA-qwph-4952-7xr6 insecure default algorithm, GHSA-hjrf-2m68-5959 RSA→HMAC key confusion), this enables signature-bypass / token forgery. **Fix:** pin `algorithms`, upgrade to `jsonwebtoken@>=9`.

(From `synthesis.md`, HIGH severity.)

## 2. What I changed

`backend/middleware/authMiddleware.js` — `protect`, pin the accepted signature algorithm on `jwt.verify`:

```diff
-      const decoded = jwt.verify(token, process.env.JWT_SECRET)
+      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
+        algorithms: ['HS256'],
+      })
```

3 lines changed, no other files touched, no new dependencies.

## 3. Why this approach

The tokens are signed with HS256 (`backend/utils/generateToken.js`), so pinning `algorithms: ['HS256']` on verification rejects any token presented under a different algorithm — closing the algorithm-confusion / `alg` substitution class without affecting legitimate tokens. The finding also recommends upgrading to `jsonwebtoken@>=9`; that is a dependency bump (separate from this code fix, and constrained by the "no new dependencies" rule of this refactor), so it is intentionally left out of this change. Pinning the algorithm is effective independently of the library version and is the smaller, lower-risk step.

## 4. Test status

Characterization tests in `homework/M6/stage2-fix-top3/tests/jwt-algorithm-allowlist.test.js`:

```
$ npx vitest run
 Test Files  3 passed (3)
      Tests  12 passed (12)
```

Four cases: valid token (user attached, `next()` called), missing token (401), invalid signature (401), and the call-contract test asserting how `jwt.verify` is invoked. All green on the fixed code; all four were green on the original code before the fix (test commit precedes fix commit).

## 5. Behavior change

**Yes — intentional, at the call-contract level.** Legitimate HS256 tokens verify exactly as before (the valid/missing/invalid-token paths are unchanged). What changes is the security contract: `jwt.verify` is now called with an explicit `{ algorithms: ['HS256'] }` allow-list, so tokens signed under any other algorithm are rejected.

The target characterization test originally pinned the insecure contract (no `algorithms` argument). After the fix it failed as expected and was updated to assert `{ algorithms: ['HS256'] }`, with an `INTENTIONAL BEHAVIOR CHANGE` comment referencing this document. The three non-target tests (valid, missing, invalid token) were unchanged and stayed green.

## 6. Lessons learned

The finding bundled two fixes — pin the algorithm and upgrade the library — but they are independent: pinning `algorithms` mitigates the algorithm-confusion vector on its own, while the version upgrade is a separate dependency change with its own risk profile. Testing the call contract (rather than crafting a forged token against a specific library version) keeps the characterization test stable and focused on the behavior the fix actually controls.

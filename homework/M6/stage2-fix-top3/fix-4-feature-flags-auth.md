# Fix 4 — Require admin auth on the feature-flags read API (SEC-04)

## 1. Original finding

> **SEC-04 — Feature-flags API is unauthenticated; admin guard is client-side only** (HIGH)
> `backend/server.js:31` + `backend/routes/featureFlagRoutes.js`. No `protect`/`admin` on `GET /api/feature-flags` and `/:featureId`. The only "admin guard" is a `useEffect` redirect in `FeatureFlagsScreen.jsx` (trivially bypassed by calling the API directly). Leaks rollout strategy, `targeted_segments`, and dependency topology to anonymous users. **Fix:** protect the read routes server-side / scope the payload.

(From `synthesis.md`, HIGH severity; cross-referenced by PERF-03 and ARCH-07.)

## 2. What I changed

`backend/routes/featureFlagRoutes.js` — guard both read routes with the existing `protect` + `admin` middleware:

```diff
 import {
   getFeatureFlags,
   getFeatureFlag,
 } from '../controllers/featureFlagController.js'
+import { protect, admin } from '../middleware/authMiddleware.js'

-router.route('/').get(getFeatureFlags)
-router.route('/:featureId').get(getFeatureFlag)
+router.route('/').get(protect, admin, getFeatureFlags)
+router.route('/:featureId').get(protect, admin, getFeatureFlag)
```

3 lines changed, no other files touched, no new runtime dependencies.

## 3. Why this approach

Feature-flag configuration (rollout strategy, targeted segments, dependency topology) is admin-only management data, so the routes are guarded with the same `protect` + `admin` middleware pair the rest of the admin API already uses — enforcing the rule server-side instead of relying on the bypassable client-side redirect. Scoping the payload for anonymous users was considered but rejected: there is no legitimate anonymous consumer of this endpoint, so requiring admin is both simpler and stricter.

## 4. Test status

HTTP-level characterization tests in `homework/M6/stage2-fix-top3/tests/feature-flags-auth.test.js` (supertest against a minimal app mounting the router; `jwt`/`User` mocked so the admin path passes `protect` without a database):

```
$ npx vitest run
 Test Files  4 passed (4)
      Tests  16 passed (16)
```

Four cases for this fix: anonymous list (now 401), anonymous single lookup (now 401), authenticated-admin list (200), authenticated-admin unknown flag (404). All green on the fixed code; all four were green on the original code before the fix (test commit precedes fix commit).

## 5. Behavior change

**Yes — intentional.** The two read routes change from public to admin-only: an anonymous caller now receives `401` instead of the flag data. An authenticated admin keeps full access (list `200`, unknown flag `404`), confirming the guard did not break legitimate use.

The two anonymous characterization tests originally pinned the public behavior (`200` / `404`). After the fix they failed as expected and were updated to assert `401`, each carrying an `INTENTIONAL BEHAVIOR CHANGE` comment referencing this document. The two admin tests were unchanged and stayed green.

## 6. Lessons learned

Making the endpoint admin-only has a client-side consequence the server fix cannot cover alone: the frontend currently fetches `/api/feature-flags` with no `Authorization` header (both `frontend/src/actions/featureFlagActions.js` via `axios.get` and the parallel `frontend/src/screens/admin/hooks/useFeatures.js` via `fetch`). Those callers will now receive `401` until they send the admin token. Updating them is a separate frontend change — and it intersects the pre-existing duplicate-implementation issue where the same screen is built twice with divergent data-fetching — so it is intentionally kept out of this backend-scoped safe-refactor and recorded here as the required follow-up.

# Fix 1 — Enforce ownership on order payment (SEC-02)

## 1. Original finding

> **SEC-02 — Payment bypass on `PUT /api/orders/:id/pay`** (HIGH)
> `backend/controllers/orderController.js:113`. Sets `isPaid = true` and stores `paymentResult` straight from `req.body` with no ownership check and no server-side verification against PayPal. Any authenticated user can mark any order paid with forged payment data. **Fix:** verify ownership/admin and verify the capture server-side against the PayPal API.

(From `synthesis.md`, Top fix list #1.)

## 2. What I changed

`backend/controllers/orderController.js` — `updateOrderToPaid`, an authorization guard before the order is mutated:

```diff
   const order = await Order.findById(req.params.id)

   if (order) {
+    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
+      res.status(403)
+      throw new Error('Not authorized to update this order')
+    }
+
     order.isPaid = true
     order.paidAt = Date.now()
```

5 lines added, no other files touched, no new dependencies.

## 3. Why this approach

The minimal, in-layer fix is an ownership/admin check at the top of the handler, mirroring the authorization pattern the codebase already uses elsewhere (`order.user` vs `req.user._id`, with an `isAdmin` escape hatch). This closes the access-control hole — a non-owner can no longer flip another customer's order to paid — without changing the route, the request/response shape, or the existing error-handling style. The finding also recommends server-side PayPal capture verification; that is a larger change (external API calls, new failure modes) and is intentionally out of scope for this safe-refactor, which targets the access-control defect only.

## 4. Test status

Characterization tests in `homework/M6/stage2-fix-top3/tests/payment-authorization.test.js`, run with the root Vitest harness:

```
$ npx vitest run
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Four cases: owner pays (allowed), admin pays a non-owned order (allowed), non-owner pays (now rejected), order not found (404). All green on the fixed code; all four were green on the original code before the fix was applied (test commit precedes fix commit).

## 5. Behavior change

**Yes — intentional.** This is a security fix, not a pure refactor, so it deliberately changes behavior for one case: an authenticated non-owner (non-admin) calling the pay endpoint now receives `403` instead of successfully marking the order paid.

The target characterization test originally pinned the insecure status quo (non-owner succeeds). After the fix it failed — the expected signal that the intended behavior change took effect — and was updated to assert the new correct behavior (`403`, order untouched, `save` not called), with an `INTENTIONAL BEHAVIOR CHANGE` comment referencing this document. The three non-target tests (owner, admin, not-found) were unchanged and stayed green, confirming the fix did not disturb adjacent behavior.

## 6. Lessons learned

The review flagged a large fix ("verify the capture server-side against PayPal"), but the actual exploitable defect is purely missing authorization — separating the access-control fix from the (real but distinct) payment-verification hardening keeps the change small, reviewable, and low-risk.

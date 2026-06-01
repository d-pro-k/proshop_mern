# Fix 2 — Enforce ownership on order retrieval (SEC-01)

## 1. Original finding

> **SEC-01 — IDOR on `GET /api/orders/:id`** (HIGH)
> `backend/controllers/orderController.js:96`. The route is behind `protect` only; the controller loads the order by id and returns it with no `order.user === req.user._id || req.user.isAdmin` check. Any logged-in user can enumerate ObjectIds and read other customers' orders (shipping address, PayPal payer email). **Fix:** reject with 403 unless the requester owns the order or is admin.

(From `synthesis.md`, Top fix list #2.)

## 2. What I changed

`backend/controllers/orderController.js` — `getOrderById`, an authorization guard after the order loads. Because this handler populates `user`, ownership is checked on `order.user._id`:

```diff
   if (order) {
+    if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
+      res.status(403)
+      throw new Error('Not authorized to view this order')
+    }
+
     res.json(order)
   } else {
```

5 lines added, no other files touched, no new dependencies.

## 3. Why this approach

The same ownership/admin guard pattern as the payment fix, adapted to this handler's populated `user` field (`order.user._id` rather than `order.user`). It returns `403` for an unauthorized reader while leaving owner and admin access, the route, and the response shape untouched. Returning `403` (rather than `404`) is consistent with the rest of the controller, which already distinguishes "not found" from other states; hiding existence behind `404` was considered but rejected as inconsistent and offering no real protection here.

## 4. Test status

Characterization tests in `homework/M6/stage2-fix-top3/tests/order-access-control.test.js`:

```
$ npx vitest run
 Test Files  2 passed (2)
      Tests  8 passed (8)
```

Four cases for this fix: owner reads (allowed), admin reads any order (allowed), non-owner reads (now rejected), order not found (404). Green on the fixed code; all four were green on the original code before the fix (test commit precedes fix commit).

## 5. Behavior change

**Yes — intentional.** Security fix, not a refactor. An authenticated non-owner (non-admin) reading another user's order now receives `403` instead of the order body.

The target characterization test originally pinned the IDOR (non-owner receives the order). After the fix it failed as expected and was updated to assert `403` with no body, carrying an `INTENTIONAL BEHAVIOR CHANGE` comment referencing this document. The three non-target tests (owner, admin, not-found) were unchanged and stayed green.

## 6. Lessons learned

SEC-01 and SEC-02 share one root cause — missing ownership authorization in the same controller — but live on different handlers with different data shapes (`order.user` is a raw ObjectId on the pay handler, a populated document on the read handler). Fixing them as two small, separately-tested changes avoided a subtle bug: a single shared helper assuming one shape would have been wrong for the other.

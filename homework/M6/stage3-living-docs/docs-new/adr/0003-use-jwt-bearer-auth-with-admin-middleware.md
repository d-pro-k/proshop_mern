# 0003: Use JWT Bearer Authentication with Role-Based Admin Middleware

## Status

Accepted (inferred from current implementation)

## Context

`backend/middleware/authMiddleware.js` reads a bearer token from the `Authorization` header, verifies it with `JWT_SECRET`, loads the user record, and exposes it on `req.user`. A separate `admin` middleware allows access only when `req.user.isAdmin` is true.

Protected routes use these middleware functions directly. For example, `backend/routes/orderRoutes.js` requires authentication for order creation and order history access, and requires both `protect` and `admin` for listing all orders and marking an order as delivered.

This shows that the backend enforces access at the API boundary through stateless token authentication and a coarse-grained role check, rather than through server-side sessions or controller-specific authorization logic.

## Decision Drivers

- Enforce authentication consistently at the route boundary rather than inside individual controllers.
- Keep the backend aligned with an SPA client that sends bearer tokens with protected requests.
- Centralize authentication and coarse-grained authorization logic for maintainability.
- Support a simple distinction between normal users and administrators without introducing a heavier permission model.

## Decision

Keep API authentication based on JWT bearer tokens and enforce administrative access through dedicated route middleware layered on top of authentication.

New protected endpoints should compose the existing middleware model by default. Any move toward session-based authentication or fine-grained authorization should be introduced as an explicit architectural change with migration impact called out.

## Alternatives

- Use server-side sessions with cookies instead of bearer tokens.
- Inline authorization checks inside controllers instead of route middleware.
- Introduce a broader policy or permission system with more granular roles and scopes.

## Consequences

- Authentication and authorization checks stay reusable and centralized instead of being duplicated across controllers.
- The API remains well aligned with the existing SPA client, which stores a token and sends it with protected requests.
- Administrative routes remain easy to identify and audit because protection is visible in route definitions.
- Authorization remains intentionally coarse-grained because `isAdmin` is a binary role check rather than a richer permission model.
- Stateless token use reduces server-side session management but also limits revocation and session-lifecycle control compared with a stateful session design.
- Controller code should not grow ad hoc authorization branches when equivalent protection belongs in route middleware.

## Confidence

HIGH

# 0002: Use Redux, Thunk, and localStorage for Client State

## Status

Accepted (inferred from current implementation)

## Context

`frontend/src/store.js` combines reducers for products, cart, users, and orders into a single Redux store. The store applies `redux-thunk` middleware and hydrates `cartItems`, `userInfo`, and `shippingAddress` from `localStorage`.

Async frontend flows such as order creation, order payment, and order fetching are implemented as thunk action creators in `frontend/src/actions/orderActions.js`. This indicates a deliberate separation between presentational React components and an application-level coordination layer for shared state, persistence, and API calls.

## Decision Drivers

- Share application state across multiple screens without relying on deep prop passing.
- Keep async request orchestration out of presentational components.
- Preserve key user journey state such as cart and login across refreshes.
- Maintain consistency with the existing reducer and action structure across the codebase.

## Decision

Continue to manage cross-screen and API-backed client state through Redux reducers and thunk action creators, while persisting selected cart and authentication-related state in `localStorage` for session continuity.

New cross-screen state, API-backed workflow state, and persistence-sensitive UI flows should default to this model unless there is a clear reason to keep them local to a single component tree.

## Alternatives

- Keep more state inside individual React components and pass it through props.
- Use React Context plus custom hooks for shared state and async flows.
- Replace the current approach with a different state-management layer such as Redux Toolkit or a server-state-focused library.

## Consequences

- State transitions remain explicit and traceable across cart, auth, product, and order flows.
- Shared user journey state survives refreshes, which supports checkout continuity and repeat navigation.
- Async behavior follows a consistent application-wide pattern instead of being embedded ad hoc in components.
- Boilerplate remains comparatively high because each feature is represented through constants, actions, reducers, and store wiring.
- The Redux store shape becomes an architectural contract across screens, so seemingly local changes can have broad downstream impact.
- Browser persistence improves UX but does not create a trusted source of truth; server-side validation is still required for sensitive workflows.
- New features that bypass this pattern can increase inconsistency in loading, error, and persistence behavior across the frontend.

## Confidence

HIGH

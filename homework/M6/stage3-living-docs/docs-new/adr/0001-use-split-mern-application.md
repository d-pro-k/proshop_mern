# 0001: Use a Split MERN Application with Express-Served CRA Build

## Status

Accepted (inferred from current implementation)

## Context

The repository is organized as a split MERN application:

- an Express and Mongoose backend in `backend/`;
- a Create React App frontend in `frontend/`.

The backend exposes JSON APIs under `/api/*`, serves uploaded files from `/uploads`, and in production serves the compiled frontend from `frontend/build`. During development, the frontend relies on a proxy to the backend instead of hardcoding environment-specific API origins in browser code.

For this legacy repository, that combination reflects an important architectural constraint: the source code is separated by concern, but deployment is intentionally kept simple by treating the app as a single web product.

## Decision Drivers

- Keep frontend and backend responsibilities separated in source control and day-to-day development.
- Preserve a simple production topology that does not require separate frontend hosting infrastructure.
- Avoid hardcoding environment-specific API origins in browser code.
- Minimize migration risk in a deprecated legacy codebase where deployment behavior is already coupled to the current structure.

## Decision

Keep the project as a split MERN application with unified production hosting:

- Express remains responsible for API endpoints, middleware, persistence access, uploads, and serving the production frontend build;
- the React frontend remains a separate source application with its own development server and build pipeline;
- frontend-to-backend communication continues to use relative `/api/...` paths plus the development proxy model.

Future changes should treat this as the default delivery model. Work that separates frontend hosting, replaces CRA, or moves to a different application topology should be handled as an explicit architectural change rather than an incidental refactor.

## Alternatives

- Keep the backend as API-only and deploy the frontend as a separately hosted static app.
- Rebuild the application around a server-rendered or fullstack framework.
- Collapse frontend assets into a backend-owned templated UI.

## Consequences

- Local development requires two coordinated runtimes: the backend process and the CRA dev server.
- Production operations stay comparatively simple because one backend process can serve both API traffic and frontend assets.
- Frontend and backend can evolve independently at the source-code level without introducing a separate production hosting topology.
- Build and deployment remain coupled because the backend expects the frontend build output in a specific location and routing model.
- Replatforming work becomes higher risk because routing, asset serving, proxy assumptions, and deployment shape are all part of the current architecture.
- Changes to routing, asset hosting, or frontend deployment should be evaluated for production impact even when they appear local to one side of the stack.

## Confidence

HIGH

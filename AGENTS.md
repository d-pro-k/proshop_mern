# AGENTS.md — ProShop MERN

## Overview

ProShop is a legacy MERN ecommerce application: an Express/Mongoose API serves products, users, orders, uploads, auth, and PayPal configuration, while a Create React App frontend provides shopping cart, checkout, profile, and admin workflows. This repository is intentionally deprecated/legacy, so prefer careful onboarding, documentation, characterization, and narrowly scoped fixes over broad modernization.

## Tech Stack

- Runtime/package manager: Node.js with npm; backend requires Node `v14.6+` for native ES modules.
- Backend: Express `^4.17.1`, Mongoose `^5.10.6`, dotenv `^8.2.0`, express-async-handler `^1.1.4`.
- Auth/security: jsonwebtoken `^8.5.1`, bcryptjs `^2.4.3`.
- Backend utilities: multer `^1.4.2`, morgan `^1.10.0`, colors `^1.4.0`.
- Dev tooling: concurrently `^5.3.0`, nodemon `^2.0.4`.
- Frontend: React `^16.13.1`, React DOM `^16.13.1`, react-scripts `3.4.3`.
- State/routing: Redux `^4.0.5`, React Redux `^7.2.1`, Redux Thunk `^2.3.0`, React Router DOM `^5.2.0`.
- UI/API: React Bootstrap `^1.3.0`, Axios `^0.20.0`, react-paypal-button-v2 `^2.6.2`.
- Tests: old Create React App/Jest setup via `react-scripts test`.

## Architecture

- Root scripts and backend dependencies live in `package.json`.
- Frontend dependencies and CRA proxy live in `frontend/package.json`; proxy points to `http://127.0.0.1:5000`.
- Backend entry point: `backend/server.js`.
- MongoDB connection: `backend/config/db.js`.
- API routes:
  - `backend/routes/productRoutes.js` mounted at `/api/products`;
  - `backend/routes/userRoutes.js` mounted at `/api/users`;
  - `backend/routes/orderRoutes.js` mounted at `/api/orders`;
  - `backend/routes/uploadRoutes.js` mounted at `/api/upload`.
- Controllers:
  - `backend/controllers/productController.js`;
  - `backend/controllers/userController.js`;
  - `backend/controllers/orderController.js`.
- Persistence models:
  - `backend/models/productModel.js`;
  - `backend/models/userModel.js`;
  - `backend/models/orderModel.js`.
- Auth/error middleware:
  - `backend/middleware/authMiddleware.js`;
  - `backend/middleware/errorMiddleware.js`.
- Seed data and import/destroy flow: `backend/seeder.js`, `backend/data/users.js`, `backend/data/products.js`.
- Uploaded/static images are served from `uploads/`.
- Frontend entry point: `frontend/src/index.js`.
- Frontend routing: `frontend/src/App.js`.
- Redux store: `frontend/src/store.js`.
- Redux actions/reducers/constants live under `frontend/src/actions`, `frontend/src/reducers`, and `frontend/src/constants`.
- UI screens live under `frontend/src/screens`; shared components live under `frontend/src/components`.
- In production, Express serves `frontend/build` from `backend/server.js`.

## Commands

Install dependencies:

```bash
npm install
npm install --prefix frontend
```

Development:

```bash
npm run dev      # backend on :5000 and frontend on :3000
npm run server   # backend only via nodemon
npm run client   # frontend only via CRA
npm start        # production-style backend start
```

Database seed:

```bash
npm run data:import
npm run data:destroy
```

Frontend build/test:

```bash
npm run build --prefix frontend
npm test --prefix frontend
```

Lint:

- There is no dedicated lint script; rely on CRA/react-scripts checks during frontend start, build, and test unless a lint script is added deliberately.

Required root `.env` variables:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=replace_with_dev_secret
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
```

## Conventions

- Backend files use native ES modules because root `package.json` has `"type": "module"`.
- Keep local backend imports explicit with `.js`; Node ESM resolution depends on it here.
- Routes define HTTP surface area and middleware ordering; controllers contain request orchestration.
- Controllers use `express-async-handler` and throw errors after setting `res.status(...)`.
- Protected endpoints use `protect`; admin endpoints use `protect, admin`.
- Mongoose schemas define persistence shape and required fields; avoid duplicating persistence rules elsewhere.
- User passwords are hashed in the `userSchema.pre('save')` hook.
- JWTs are created in `backend/utils/generateToken.js` and verified in `authMiddleware.js`.
- Frontend components are function components with hooks.
- React Router v5 uses `<Route path=... component={...} />` in `frontend/src/App.js`.
- Async frontend behavior belongs in Redux thunk action creators under `frontend/src/actions`.
- Reducers should remain pure state transitions based on constants from `frontend/src/constants`.
- Frontend API calls use relative `/api/...` URLs so CRA proxy and production Express hosting both work.
- `localStorage` stores `cartItems`, `userInfo`, `shippingAddress`, and `paymentMethod`.
- Prefer focused fixes that keep API response shapes, Redux state shape, route URLs, and env var names stable.
- Use focused commits with Conventional Commit-style messages; PR titles should match the main workstream.
- After changing models, seed data, or required fields, rerun `npm run data:destroy` and `npm run data:import` against a local/dev database.

## What NOT to Do

- Do not casually modernize dependencies while working on docs, findings, or small fixes.
- Do not convert the app to Next.js, Redux Toolkit, TypeScript, Vite, or another architecture unless explicitly requested.
- Do not mix route definitions, persistence model changes, Redux state changes, and documentation updates in one commit.
- Do not remove `.js` extensions from backend local imports.
- Do not commit `.env`, secrets, real PayPal credentials, database URLs with passwords, or temporary local working notes.
- Do not document environment variables from README alone; verify actual `process.env` usage in code.
- Do not change `Procfile`, `heroku-postbuild`, or Express serving `frontend/build` unless deployment is explicitly in scope.
- Do not hide dependency upgrades inside bugfix commits; upgrades must be isolated and verified.
- Do not change seeded sample users/products casually; seed behavior is part of local onboarding.
- Do not introduce new cross-cutting abstractions unless repeated behavior already exists in multiple places.
- Do not change public route URLs, API response shapes, or Redux state shape without documenting the compatibility impact.

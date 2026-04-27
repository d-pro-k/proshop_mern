# ProShop MERN

Legacy MERN ecommerce application for a small online store: shoppers can browse products, manage carts, and place orders, while admins can manage products, users, and order delivery state. This README documents the setup and development flow for the current state of this repository.

## Deprecated Upstream

The upstream project is marked deprecated by the author. That matters here because the stack is intentionally old: backend ES modules, Mongoose 5, React 16, Redux, and `react-scripts@3.4.3`. Expect deprecation warnings and a few local setup quirks on modern tooling.

## Tech Stack

### Backend

- Node.js `v14.6+` required for native ES modules
- Express `^4.17.1`
- Mongoose `^5.10.6`
- dotenv `^8.2.0`
- express-async-handler `^1.1.4`
- jsonwebtoken `^8.5.1`
- bcryptjs `^2.4.3`
- multer `^1.4.2`
- morgan `^1.10.0`

### Frontend

- React `^16.13.1`
- React DOM `^16.13.1`
- react-scripts `3.4.3`
- Redux `^4.0.5`
- React Redux `^7.2.1`
- Redux Thunk `^2.3.0`
- React Router DOM `^5.2.0`
- React Bootstrap `^1.3.0`
- Axios `^0.20.0`
- react-paypal-button-v2 `^2.6.2`

## Repository Structure

```text
.
├── backend/                Express API, controllers, models, routes, seed data
│   ├── config/             MongoDB connection setup
│   ├── controllers/        Product, user, and order request handlers
│   ├── data/               Seed users and products
│   ├── middleware/         Auth and error middleware
│   ├── models/             Mongoose schemas
│   ├── routes/             API route definitions
│   ├── utils/              JWT helper
│   ├── seeder.js           Import/destroy seed data
│   └── server.js           Backend entry point
├── frontend/               Create React App client
│   ├── public/             Static CRA assets
│   ├── src/                Screens, components, Redux store, actions, reducers
│   ├── package.json        Frontend scripts and proxy config
│   └── build/              Production build served by Express in production
├── uploads/                Uploaded and sample images
├── package.json            Root scripts and backend dependencies
├── AGENTS.md               Codex project instructions
└── .env.example            Example local environment variables
```

## Prerequisites

- Node.js and npm
  - Node `v14.6+` is required
  - modern Node versions may need the OpenSSL workaround documented below for the frontend
- MongoDB
  - quick start option: Docker container `mongo:7`
  - alternatives: local MongoDB install or Atlas
- PayPal developer sandbox account
  - needed if you want the real PayPal button/client ID flow

## Environment Variables

Create a root `.env` file from `.env.example`.

```env
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=replace_with_dev_secret
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
```

Notes:

- This repository is configured for backend `PORT=5001`.
- The frontend proxy is configured as `http://127.0.0.1:5001`.
- Do not commit your real `.env`.

## Install Dependencies

Install backend/root dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm install --prefix frontend
```

Equivalent frontend install from inside the folder:

```bash
cd frontend
npm install
```

Notes:

- On npm `11`, both lockfiles are rewritten to `lockfileVersion: 3`.
- Old packages emit deprecation and audit warnings. They were documented, not upgraded as part of onboarding.

## Start MongoDB

Docker example:

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

If the container already exists, start it with:

```bash
docker start mongo
```

## Seed the Database

Import sample users and products:

```bash
npm run data:import
```

Destroy seeded data:

```bash
npm run data:destroy
```

Sample users after import:

- `admin@example.com` / `123456`
- `john@example.com` / `123456`
- `jane@example.com` / `123456`

## Run in Development

Recommended order for a first local run:

1. Start MongoDB.
2. Create `.env` from `.env.example`.
3. Install root and frontend dependencies.
4. Seed the database with `npm run data:import`.
5. Start the backend on `http://localhost:5001`.
6. Start the frontend on `http://localhost:3000`.

### Backend only

```bash
npm run server
```

Expected backend URL:

- `http://localhost:5001`

### Frontend only

On modern Node versions, CRA 3 may need the OpenSSL legacy provider:

```bash
NODE_OPTIONS=--openssl-legacy-provider npm run client
```

Expected frontend URL:

- `http://localhost:3000`

### Full dev flow

The repository script is still:

```bash
npm run dev
```

If `npm run dev` is not enough for your environment, run backend and frontend in separate terminals so the frontend can start with `NODE_OPTIONS=--openssl-legacy-provider`.

## Build

Create the frontend production build:

```bash
npm run build --prefix frontend
```

In production, Express serves `frontend/build` from `backend/server.js`.

## Verification Checklist

After setup, confirm:

- backend root responded at `http://localhost:5001/`
- backend products endpoint responded at `http://localhost:5001/api/products`
- frontend loaded at `http://localhost:3000/`
- frontend proxy reached backend data through `http://localhost:3000/api/products`
- PayPal config endpoint responded
- seeded admin login worked with `admin@example.com` / `123456`
- authenticated order creation succeeded

## Troubleshooting

### Port 5000 already in use

Original upstream docs assume backend port `5000`, but this repository is configured for `5001`. Keep these aligned:

- `.env`: `PORT=5001`
- `frontend/package.json`: proxy `http://127.0.0.1:5001`

### `ERR_OSSL_EVP_UNSUPPORTED` from CRA

`react-scripts@3.4.3` uses older Webpack hashing and fails on modern Node/OpenSSL defaults. Start the frontend with:

```bash
NODE_OPTIONS=--openssl-legacy-provider npm run client
```

### MongoDB connection errors

If seeding or backend startup fails:

- confirm Docker/container state with `docker ps`
- confirm MongoDB is listening on `localhost:27017`
- confirm `MONGO_URI=mongodb://localhost:27017/proshop`

### Dependency warnings during install

This repository uses old packages. `npm install` may report deprecated packages and many audit findings. That is expected for this homework fork and should be treated as a documented finding, not an automatic upgrade task.

### PayPal button does not load

Check that:

- `PAYPAL_CLIENT_ID` is present in `.env`
- the value is a sandbox client ID, not a secret
- backend endpoint `/api/config/paypal` responds

## License

MIT, inherited from the upstream project.

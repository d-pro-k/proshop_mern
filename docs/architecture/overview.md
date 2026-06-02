# Architecture Overview

This document captures the current runtime architecture of `proshop_mern` as it exists in the repository today. It focuses on the real request and data flow between the browser, the React/Redux frontend, the Express API, MongoDB, PayPal, and local file uploads.

```mermaid
flowchart LR
  user[Browser / User]

  subgraph frontend[Frontend]
    react[React SPA<br/>React Router screens + shared components]
    redux[Redux Store]
    thunks[Thunk Actions]
  end

  subgraph backend[Backend]
    express[Express Server]
    routes[Routes<br/>/api/products<br/>/api/users<br/>/api/orders<br/>/api/upload]
    controllers[Controllers]
    models[Mongoose Models]
  end

  mongo[(MongoDB)]
  paypal[PayPal Sandbox / JS SDK]
  uploads[Uploads Directory]

  user -->|loads app and interacts with screens| react
  react -->|dispatches actions| thunks
  thunks -->|updates state| redux
  redux -->|provides state via selectors| react

  react -->|Axios calls relative /api/... endpoints| express
  thunks -->|GET/POST/PUT via Axios| express
  express -->|mounts API endpoints| routes
  routes -->|delegate product, user, and order requests| controllers
  controllers -->|read and write data| models
  models -->|persist documents| mongo

  express -->|GET /api/config/paypal returns client ID| react
  react -->|loads PayPal JS SDK in OrderScreen| paypal
  paypal -->|payment result returned in browser| react
  react -->|PUT /api/orders/:id/pay| express

  react -->|POST /api/upload multipart/form-data| express
  routes -->|/api/upload inline multer handler writes files| uploads
  express -->|serves static /uploads URLs| react
```

## Runtime Flow

- Product browsing starts in the browser, where React Router renders screens such as `HomeScreen` and `ProductScreen`. Those screens dispatch thunk actions that call `/api/products`, and the backend resolves the request through routes, controllers, Mongoose models, and MongoDB before Redux updates the UI state.
- Authenticated checkout starts from cart and checkout screens in the React app. The browser keeps cart and user state in Redux and local storage, then thunk actions submit order requests to `/api/orders`, where the Express order controller validates the payload, rebuilds trusted order totals, and stores the order in MongoDB.
- PayPal payment starts on `OrderScreen`, which first requests `GET /api/config/paypal` to receive the sandbox client ID. The browser loads the PayPal JS SDK, completes the payment in the client, and then sends the payment result back to `PUT /api/orders/:id/pay`.
- Product image upload happens from the admin product edit screen. The browser sends `multipart/form-data` to `/api/upload`, the inline upload route writes the file into `uploads/`, and Express later serves that path back as a static `/uploads/...` asset.

## Notes / Current Boundaries

- The frontend uses relative `/api/...` URLs. In local development, Create React App proxies those requests to the backend port configured in `frontend/package.json`.
- In production mode, the Express server also serves `frontend/build`, so the API and the compiled frontend are hosted by the same backend process.
- On the backend, request handling is wrapped by Express JSON parsing, optional `morgan` logging in development, and shared not-found/error middleware.
- The main business APIs follow a route -> controller -> model pattern. The upload path is a legacy exception implemented as an inline `multer` route handler that writes directly to disk.
- This is a current-state architecture snapshot of the legacy app. It describes how the repository works today and does not propose a redesign.

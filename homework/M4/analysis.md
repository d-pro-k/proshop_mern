# proshop_mern — frontend analysis (M4 / Part 1)

## Pages

16 screens in `frontend/src/screens/` (no subfolders — all files at top level):

- `/` — `HomeScreen.js` — product grid, top-rated carousel, search, pagination
- `/product/:id` — `ProductScreen.js` — product details, rating, review form, Add to Cart button
- `/cart` — `CartScreen.js` — cart items, subtotal, Proceed to Checkout
- `/login`, `/register` — `LoginScreen.js`, `RegisterScreen.js` — auth forms
- `/profile` — `ProfileScreen.js` — user info + order history
- `/shipping` → `/payment` → `/placeorder` → `/order/:id` — `ShippingScreen.js`, `PaymentScreen.js`, `PlaceOrderScreen.js`, `OrderScreen.js` — checkout flow
- `/admin/userlist`, `/admin/user/:id/edit` — `UserListScreen.js`, `UserEditScreen.js`
- `/admin/productlist`, `/admin/product/:id/edit` — `ProductListScreen.js`, `ProductEditScreen.js`
- `/admin/orderlist` — `OrderListScreen.js`
- `/admin/feature-flags` (presumed route) — `DashboardFeaturesScreen.js` — **existing** baseline Dashboard (M3 artifact): Bootstrap Table + Redux action `listFeatureFlags` → backend. To be replaced by a full shadcn Dashboard in M4.

## Frontend stack

- **React:** 16.13.1
- **Router:** React Router v5.2.0 (react-router-dom) — v5, not v6 (affects shadcn pipeline in Task 2.x)
- **State:** Redux 4.0.5 + react-redux 7.2.1 + redux-thunk 2.3.0 + redux-devtools-extension 2.13.8
- **HTTP:** axios 0.20.0
- **CSS:** Bootstrap (local file `frontend/src/bootstrap.min.css`, not an npm package) + react-bootstrap 1.3.0
- **UI library (current):** react-bootstrap 1.3.0 — Table, Button, Form, Card, Container, Row, Col, Alert, Spinner, Badge, Carousel, ListGroup, Nav, Navbar, Breadcrumb, Modal
- **Other UI libraries (shadcn/MUI/Chakra/Ant/Radix/Headless/Tailwind/styled-components):** none installed — Tailwind + shadcn/ui will be added in Task 2.0
- **Build:** react-scripts 3.4.3 (CRA), needs `NODE_OPTIONS=--openssl-legacy-provider` on Node 17+ (flag is already wired into the root `npm run client` script)

## Existing components (reusable)

12 components in `frontend/src/components/`:

- `Header.js` — Navbar with search (`SearchBox`), Cart link and Admin dropdown
- `Footer.js` — minimal footer
- `Product.js` — product card (react-bootstrap Card: image, name, rating, price)
- `Rating.js` — star rating via FontAwesome-like icons + review count
- `Loader.js` — react-bootstrap Spinner (centered)
- `Message.js` — react-bootstrap Alert (variant prop: danger/success/info)
- `Meta.js` — react-helmet for SEO `<title>` and `<meta>`
- `FormContainer.js` — Row + Col with centering, used by all auth/checkout forms
- `Paginate.js` — react-bootstrap Pagination (supports admin mode)
- `ProductCarousel.js` — react-bootstrap Carousel (top-rated products)
- `SearchBox.js` — react-bootstrap Form + Button, routes to `/search/:keyword`
- `CheckoutSteps.js` — visual checkout step indicator (Nav with `disabled`)

## What is outdated / needs replacement on redesign

- Bootstrap (local file, version unknown) — dated visual language, heavy primary-blue, thick radii, no design tokens
- Font — system sans-serif fallback, not fixed, no typographic scale
- Product cards — heavy border + Bootstrap-default box-shadow, no hover animations
- No CSS variables across the UI — no single source of truth for color, spacing, typography
- No dedicated admin layout — admin screens render through the same `Header`/`Footer`
- `DashboardFeaturesScreen.js` — baseline Bootstrap Table without toggle/slider/search/filter, wired to backend (M3); rewritten in M4

## What can be reused on redesign

- Redux actions/reducers/store — containerless logic, independent of the UI layer
- Routes and ProtectedRoute wrappers in `App.js`
- `FormContainer.js` — can be adapted onto shadcn `Card` as a layout wrapper
- `Loader.js`, `Message.js` — replaceable by shadcn `Skeleton` / `Alert` (drop-in by semantics)
- `Rating.js` — keep as-is, simple enough (or swap for SVG stars without Bootstrap)

## "Before" screenshots

- ![home](screenshots/before/home.png)
- ![product](screenshots/before/product.png)
- ![cart](screenshots/before/cart.png)

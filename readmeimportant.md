# Restaurant platform

React/Vite customer and staff web interfaces, Express/TypeScript REST API, PostgreSQL/Prisma persistence, and Socket.IO updates.

`PRD.md` defines the product vision. `IMPLEMENTATION.md` records completed work and verification. `walkthrough.md` describes the current workflows and remaining manual checks.

## Applications

- `client/`: the maintained customer storefront, login, tenant admin, branch manager, kitchen, rider, and platform admin web views.
- `server/`: API, authorization, pricing, operations, audit records, and database schema.
- Root `index.html`, `js/`, and `css/`: historical standalone demo. Its checkout and tracking are simulated; it is not the maintained ordering application.
- `data/`: seed catalog. Database records become the runtime source of truth after setup.

## Local setup

Use Node.js 20+ and PostgreSQL. Node 24.14.0 was used for verification.

1. Install dependencies with `npm ci` in both `client/` and `server/`.
2. Copy `server/.env.example` to `server/.env` and configure `DATABASE_URL`, `CLIENT_ORIGIN`, and random `JWT_SECRET`/`REFRESH_SECRET` values. Environment files are ignored by Git. Without explicit signing secrets, development uses random process-local secrets and sessions expire when the server restarts.
3. In `server/`, run `npm run db:generate` and `npm run db:push` for a local development database.
4. For a new demo database, run `npm run db:seed`. The seed writes demo branding, menus, users, vouchers, and staff memberships. It replaces seeded option groups and banners; do not use it as a production migration.
5. Run `./start.sh`, or run `npm run dev` separately in `server/` and `client/`.

Customer application: `http://localhost:5173/?tenant=cheezious` or `?tenant=savour-foods`.
API health: `http://localhost:5000/api/health`.

The tenant switcher and preset demo login buttons are development conveniences. Production deployments should select a tenant using the URL/configuration. Demo credentials must not be deployed to production.

For an existing database, staff need explicit `BranchStaff` memberships. Kitchen and branch-manager authorization does not grant tenant-wide access by default. The local seed assigns its demonstration staff to the first branch alphabetically.

## Current workflows

- Browse menus without signing in; carts and selected branches persist separately for each tenant.
- Sign in to request a quote, place an order, view personal history, and track an order. Switching tenants signs out non-platform users.
- Product options use database IDs and selection constraints. The server calculates the subtotal, discount, tax, delivery fee, and total. Client-supplied prices are ignored.
- Delivery and pickup use `DELIVERY` and `TAKEAWAY`. COD is the currently implemented payment method. Disabled modes are rejected.
- Kitchen staff handle their assigned branches. Delivery orders proceed through rider assignment and delivery actions; pickup orders can be marked collected when ready.
- Riders receive only their own assignments, save availability, and explicitly enable browser geolocation. Sharing requires a secure browser context (HTTPS or localhost), device permission, and an active delivery. Customers see incoming coordinates on an OpenStreetMap embed.
- Admins manage products, stock, branch opening status, branding, rider dispatch, and basic analytics. Platform revenue is grouped by currency.

## Access and real-time behavior

Protected order and delivery routes require JWT authentication and tenant ownership. Customer queries include customer ownership; rider queries include assignment ownership; branch staff queries include explicit branch memberships.

Socket connections authenticate with `{ token, tenantSlug }`. Anonymous clients receive only catalog events. Staff/rider rooms are selected by the server. `join:order` checks order ownership. There is no global kitchen room or unauthenticated location-publishing event. Order lifecycle actions write audit entries.

## Checks

In `client/`: `npm run build`.
In `server/`: `npm run build` and `npm test`.

`npm test` runs isolated pricing/authorization/Socket.IO regression checks using database doubles and local HTTP sockets. Both projects' dependencies must be installed.

With the backend running on port 5000 and the configured local database available, run `npm run test:integration` in `server/`. It creates a temporary tenant, exercises checkout and delivery through HTTP, and removes its temporary business data and audit records in cleanup.

Backend production entry: `npm start` runs `dist/src/index.js` after a build.
Set `VITE_DEFAULT_TENANT_SLUG` and `DEFAULT_TENANT_SLUG` to choose a deployment default; otherwise the first active restaurant is used.
Set `VITE_API_URL` when the frontend and backend are on different origins. Configure `CLIENT_ORIGIN` to the actual frontend origin.

## Remaining product scope

The PRD is a vision document, not a completed production checklist. Native Android/iOS apps, payment-provider processing/refunds, production migrations and deployment, session refresh/revocation, voucher redemption limits, comprehensive audit coverage, full menu-option/settings editors, and advanced analytics remain future work.

Browser visual checks and physical-device geolocation were unavailable in this session. See `walkthrough.md` for the manual checklist. Removing `.env` from the current Git index does not remove secrets from earlier commits; any previously shared credentials need rotation and repository-history handling separately.

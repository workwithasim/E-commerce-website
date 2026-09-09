# Implementation progress

Scope: repair the existing web platform against the vision in `PRD.md`. Native mobile apps and payment-provider integrations are separate future deliverables.

An item is marked complete only after its implementation and relevant checks pass.

- [x] Secure orders, deliveries, tenant boundaries, and WebSocket subscriptions.
- [x] Correct server pricing, option validation, checkout payloads, and order transitions.
- [x] Restore storefront layouts and configuration-driven branding; isolate tenant state.
- [x] Connect rider assignments, availability, and real device location to customer tracking.
- [x] Replace misleading tests and verify builds, security, and core workflows.
- [x] Update setup documentation, walkthrough, and PRD implementation status.

## Operations expansion

The detailed inventory and migration risks are recorded in `GAP_ANALYSIS.md`.

### Phase A — Authentication/RBAC completion

- [x] Refresh-token persistence, 15-minute access tokens, hashed refresh-token storage, one-time rotation, logout revocation, refresh expiry checks, and disabled-user refresh rejection.
- [x] Customer registration and unified login both issue the same access/refresh session contract.
- [x] The web client stores rotated tokens, retries an authenticated request once after refresh, and clears invalid sessions.
- [x] Additive normalized tenant role assignments, multiple roles per identity, permission-key middleware, and explicit dispatcher/support roles, with legacy compatibility and a local backfill command.
- [x] Role-specific login URLs and self-service session listing/revocation API.

Phase A is implemented and automatically verified. Manual browser verification of portal routing remains pending. Existing `User.role` and `BranchStaff` remain as compatibility fields; removal requires a later controlled production migration.

### Phase B — Admin staff/rider management

- [x] Tenant-authorized staff list/search/filter API and admin screen.
- [x] Admin-created staff invitations with hashed, expiring tokens; development returns an explicit local invitation path without claiming email delivery.
- [x] Invitation acceptance/password creation, role and multi-branch assignment changes, staff deactivation/reactivation, refresh-session revocation, and append-only audit entries.
- [x] Rider creation through staff management creates an offline rider profile scoped to an authorized branch.
- [x] Rider profile editor for branch, vehicle, registration, and delivery zone, with delivery history and recent operational activity.
- [ ] COD accountability belongs to Phase E; staff/rider UI visual polish and browser verification remain pending.

### Phase C — Complete admin order view

- [x] Staff-only, tenant/branch-scoped order-detail API and admin dialog.
- [x] Customer/account summary, items, financial breakdown, kitchen actors/timing, rider/delivery timestamps, payment state, previous-order count, and one chronological timeline composed from existing status history and audit records.
- [x] Database integration verifies authorized admin access, customer rejection, totals, preparation duration, and actor visibility.
- [ ] Internal notes, communication, COD settlement, issues, and manual override sections depend on their later dedicated phases. Browser layout/keyboard verification remains pending.

## Verification log

- Initial review: client build and server type check pass, but runtime contracts and access controls need repair.
- Access/pricing milestone: 13 regression tests pass, covering anonymous access, tenant mismatch, ownership scopes, socket room restrictions, invalid options/quantities, voucher expiry, delivery discounts, and state transitions. Server and client type checks pass. Tests use isolated database doubles, not production data.
- Orders now require sign-in; anonymous menu browsing and carts remain supported. COD is the only implemented payment method. Unsupported payment modes and usage-limited vouchers are rejected explicitly.
- Storefront milestone: client production build passes. Product prices, tenant banners/categories/contact details, cart persistence, checkout styles, and mobile controls use the new contracts. Browser runtime reports no connected browser, so visual/device checks remain explicitly unverified.
- Rider milestone: a PostgreSQL-backed temporary tenant completed quote → checkout → kitchen → rider assignment → accepted → pickup → on-the-way → location update → delivered. Voucher/tax totals, order history, customer ownership, cross-tenant rejection, and omission of password fields were verified. Temporary records were removed afterward. Actual browser geolocation permission/device behavior remains unverified.
- Previous baseline final checks: both production builds passed; all 13 then-current regression tests passed; the database integration flow passed against the rebuilt backend. `git diff --check` and `bash -n start.sh` passed. Test backend processes were stopped after verification.
- Documentation milestone: `PRD.md`, `readmeimportant.md`, and `walkthrough.md` now distinguish implemented web behavior, verification evidence, and remaining product scope. Unsupported references to nonexistent PRD sections were removed from maintained code.
- Session lifecycle increment: 16 server tests pass, including refresh-token hashing, successful one-time rotation, reuse rejection, logout revocation, and disabled-user rejection. Server and client production builds pass. The database-backed integration flow also verifies persisted refresh rotation, reuse rejection, and logout revocation. Manual browser expiry behavior remains pending.
- RBAC/staff/rider/admin-order increment: 20 server tests pass. New coverage verifies combined roles, cross-tenant assignment rejection, assigned-branch order scope, and support/payment separation. The PostgreSQL-backed flow verifies staff lifecycle/audit, rider management, and the staff-only complete order projection/timeline while rejecting customer access. The local additive schema and nine existing tenant users were backfilled successfully.
- Local secrets: `server/.env` was removed from the Git index while retaining the local file. Historical commits are unaffected. The example environment file now contains placeholders and the correct origin/secret settings.

## Remaining verification and future scope

- [ ] Browser visual/keyboard/mobile checks and physical-device geolocation permissions (no browser connected in this session).
- [ ] Native Android/iOS applications and payment-provider processing/refunds.
- [ ] Browser verification of role-specific portals and staff/rider forms (browser discovery returned no connected browser).
- [ ] Controlled production migration/removal plan for compatibility role fields, complete rider management, voucher redemption limits, complete audit coverage, full settings/menu-option editors, and advanced analytics.

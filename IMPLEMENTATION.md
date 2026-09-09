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
- [x] Rider profiles expose COD delivery history, while collection and settlement accountability is implemented in Phase E.
- [ ] Staff/rider UI visual polish and browser verification remain pending.

### Phase C — Complete admin order view

- [x] Staff-only, tenant/branch-scoped order-detail API and admin dialog.
- [x] Customer/account summary, items, financial breakdown, kitchen actors/timing, rider/delivery timestamps, payment state, previous-order count, and one chronological timeline composed from existing status history and audit records.
- [x] Database integration verifies authorized admin access, customer rejection, totals, preparation duration, and actor visibility.
- [x] Internal notes, communication, and COD accountability now extend the same order detail in Phases D and E.
- [ ] Issues, manual overrides, and browser layout/keyboard verification remain pending.

### Phase D — Customer/admin/rider communication

- [x] Tenant/order-authorized message storage and APIs with sender identity/role and timestamps.
- [x] Customer ownership, staff permission/branch scope, assigned-rider access, post-delivery rider cutoff, and cross-customer denial.
- [x] Existing lifecycle history appears as distinct system messages; human messages emit through the existing private order Socket.IO room.
- [x] Customer tracking, rider assignment, and admin order-detail chat interfaces.
- [x] Staff-only internal order notes with audit entries; customer APIs and note endpoints do not expose them.
- [ ] Read receipts, conversation moderation tools, and browser/realtime visual verification.

### Phase E — COD reconciliation

- [x] Every new COD order creates a tenant-scoped accountability record transactionally from the server-authoritative total.
- [x] Only the assigned rider can record active-delivery collection; amount differences become disputes and exact collection marks the order paid.
- [x] Duplicate collection is rejected atomically, and COD delivery completion is blocked until collection is recorded.
- [x] Payment managers can mark pending settlement, settle, or dispute with restaurant-received amount, actors, timestamps, differences, and a required dispute reason.
- [x] Collection and settlement changes create append-only audit entries and emit through the existing private order room.
- [x] Rider and admin order views expose the permitted COD workflow; customer order APIs do not receive staff accountability fields.
- [ ] Browser/device verification and a dedicated tenant-wide COD dashboard remain pending.

### Phase F — Audit expansion

- [x] Tenant-scoped audit listing API with actor, role, branch, date, action, entity, and entity-ID filters plus bounded pagination.
- [x] Admin Audit Logs tab with filters, previous/new state disclosure, loading, error, empty, and pagination states.
- [x] New order, kitchen, delivery, staff, rider, internal-note, and COD audit writes preserve actor-role context and branch context where applicable.
- [x] Server/client builds and the 20-test regression suite pass; the refresh-session test is now isolated from external database availability.
- [x] PostgreSQL-backed verification proves tenant-admin filtered access, actor/branch context, and customer/support denial; temporary records are removed afterward.
- [ ] Remaining settings/menu/voucher/customer/override audit coverage and browser verification are pending.

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
- Communication increment: server/client builds and the 20-test regression suite pass. The PostgreSQL-backed flow verifies customer and active assigned-rider messaging, customer visibility of rider replies, unrelated-customer denial, rider cutoff after delivery, customer denial of internal notes, and audited admin note creation.
- COD reconciliation increment: server/client builds and all 20 regression tests pass. The PostgreSQL-backed flow verifies the expected server total, pre-collection delivery block, assigned-rider collection, customer denial, duplicate protection, support-staff settlement denial, admin settlement transitions, paid state, and audit entries.
- Audit-viewer increment: server/client builds and all 20 regression tests pass. The additive schema was applied, and the PostgreSQL-backed flow verifies filtered tenant-admin access, actor/branch context, and customer/support denial. The temporary verification tenant was removed afterward.
- Local secrets: `server/.env` was removed from the Git index while retaining the local file. Historical commits are unaffected. The example environment file now contains placeholders and the correct origin/secret settings.

## Remaining verification and future scope

- [ ] Browser visual/keyboard/mobile checks and physical-device geolocation permissions (no browser connected in this session).
- [ ] Native Android/iOS applications and payment-provider processing/refunds.
- [ ] Browser verification of role-specific portals and staff/rider forms (browser discovery returned no connected browser).
- [ ] Controlled production migration/removal plan for compatibility role fields, voucher redemption limits, complete audit coverage, full settings/menu-option editors, and advanced analytics.

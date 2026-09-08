# Implementation progress

Scope: repair the existing web platform against the vision in `PRD.md`. Native mobile apps and payment-provider integrations are separate future deliverables.

An item is marked complete only after its implementation and relevant checks pass.

- [x] Secure orders, deliveries, tenant boundaries, and WebSocket subscriptions.
- [x] Correct server pricing, option validation, checkout payloads, and order transitions.
- [x] Restore storefront layouts and configuration-driven branding; isolate tenant state.
- [x] Connect rider assignments, availability, and real device location to customer tracking.
- [x] Replace misleading tests and verify builds, security, and core workflows.
- [x] Update setup documentation, walkthrough, and PRD implementation status.

## Verification log

- Initial review: client build and server type check pass, but runtime contracts and access controls need repair.
- Access/pricing milestone: 13 regression tests pass, covering anonymous access, tenant mismatch, ownership scopes, socket room restrictions, invalid options/quantities, voucher expiry, delivery discounts, and state transitions. Server and client type checks pass. Tests use isolated database doubles, not production data.
- Orders now require sign-in; anonymous menu browsing and carts remain supported. COD is the only implemented payment method. Unsupported payment modes and usage-limited vouchers are rejected explicitly.
- Storefront milestone: client production build passes. Product prices, tenant banners/categories/contact details, cart persistence, checkout styles, and mobile controls use the new contracts. Browser runtime reports no connected browser, so visual/device checks remain explicitly unverified.
- Rider milestone: a PostgreSQL-backed temporary tenant completed quote → checkout → kitchen → rider assignment → accepted → pickup → on-the-way → location update → delivered. Voucher/tax totals, order history, customer ownership, cross-tenant rejection, and omission of password fields were verified. Temporary records were removed afterward. Actual browser geolocation permission/device behavior remains unverified.
- Final checks: both production builds pass; all 13 regression tests pass; the database integration flow passes against the rebuilt backend. `git diff --check` and `bash -n start.sh` pass. Test backend processes were stopped after verification.
- Documentation milestone: `PRD.md`, `readmeimportant.md`, and `walkthrough.md` now distinguish implemented web behavior, verification evidence, and remaining product scope. Unsupported references to nonexistent PRD sections were removed from maintained code.
- Local secrets: `server/.env` was removed from the Git index while retaining the local file. Historical commits are unaffected. The example environment file now contains placeholders and the correct origin/secret settings.

## Remaining verification and future scope

- [ ] Browser visual/keyboard/mobile checks and physical-device geolocation permissions (no browser connected in this session).
- [ ] Native Android/iOS applications and payment-provider processing/refunds.
- [ ] Production migrations/deployment, token refresh/revocation, voucher redemption limits, complete audit coverage, full settings/menu-option editors, and advanced analytics.

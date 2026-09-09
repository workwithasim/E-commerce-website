# Next-phase gap analysis

Assessment date: 2026-09-09. This compares `oveview.md` with the maintained `client/` and `server/` application. It is an implementation inventory, not a completion claim.

## 1. Existing models, routes, and components

- Tenant, branding, settings, domains, users, branches, branch staff, menu categories/products/options, orders/items/status history, riders/deliveries/locations, vouchers, banners, refresh tokens, and audit logs already exist in Prisma.
- Existing REST modules cover authentication, tenants, catalog, branches, quotes/orders, deliveries/riders, vouchers, banners, and basic analytics.
- Existing React views cover the storefront and customer tracking, unified login/registration, tenant/branch administration, kitchen processing, rider workflow, and platform administration.
- Existing access controls enforce tenant, customer-order, rider-assignment, and staff-branch scope. Socket.IO selects operational rooms server-side.

## 2. Functionality needing UI exposure

- Order status history, delivery timestamps, financials, actors, existing audits, internal notes, communication, and COD reconciliation now feed a staff-only complete admin order-detail dialog. Issues and privileged overrides remain pending.
- Core operational audit records now have a filtered admin viewer with database-backed authorization coverage; remaining administrative mutation coverage is still pending.
- Rider branch, vehicle, availability, current assignments, and history exist but lack a full management profile/editor.
- Tenant settings and product option groups exist but have only partial editors.

## 3. Functionality needing extension

- Authentication still uses one identity table. An additive `RoleAssignment` layer now supports multiple tenant roles and branch scopes, while `User.role` and `BranchStaff` remain compatibility fields pending a controlled production migration.
- Session persistence existed without rotation/logout. The first new increment now implements hashed refresh tokens, rotation, logout, expiry, and disabled-user enforcement; device/session listing and force-logout UI remain pending.
- Order lifecycle history needs actor details, operational timestamps/metrics, notes, issues, and a complete admin projection.
- Riders can now be invited, branch-assigned, deactivated, and edited with vehicle/zone information; admins can inspect delivery history/activity and assigned riders can record COD collection.
- Search, reports, settings, menu administration, notifications, and audit coverage are partial.

## 4. Missing database entities or fields

- Production migration/backfill tracking for the implemented additive role assignments and permissions.
- Complete device labels and privileged force-logout controls beyond the implemented self-service session records.
- Customer addresses.
- Order issues and notifications remain missing. Internal notes and order conversations are now implemented.
- Complete provider payment/refund records remain missing. COD collection and restaurant settlement records are implemented.
- Voucher redemption records plus branch/product/category applicability.
- Additional delivery timestamps, rider zone/profile fields, and branch delivery/business-hours configuration.

These should be introduced incrementally. Existing `OrderStatusHistory` and `AuditLog` should be extended/reused rather than duplicated.

## 5. Missing API endpoints

- Tenant-wide COD dashboard/report endpoints remain incomplete; secure rider collection, payment-manager settlement, and scoped listing endpoints are implemented.
- Admin customer search/profile/deactivation and customer profile/address/reorder operations.
- Issues, privileged overrides, and audit-query endpoints still need to extend the admin order detail. Internal notes, authorized communication, and COD reconciliation are integrated.
- Notifications, provider payment administration, refunds, and voucher-redemption operations.
- Complete branch/settings/menu-option administration and operational reports.

## 6. Missing frontend routes and screens

- Role-specific admin/staff/kitchen/branch/rider/platform login URLs now share the unified identity backend. A dedicated `/account` view is still missing.
- Staff/rider management, complete core order detail/timeline, chat, internal notes, and order-level COD controls are implemented. Customers, dispatch polish, tenant-wide payments/COD, audit, reports, full settings, and menu-option screens are missing or partial.

## 7. Missing permission rules

- Permission-key policies, dispatcher/support roles, and multiple tenant/branch assignments are implemented additively.
- New payment, communication, audit, override, and customer-management endpoints must apply the policy layer and receive endpoint-level integration coverage as they are introduced.

## 8. Missing audit events

- Customer disable; branch/settings/menu/voucher changes; issues/overrides; provider payment changes; conversation access where required; and session administration remain incomplete. Staff lifecycle, internal notes, COD collection/settlement, order, and delivery activity now preserve actor role and branch context where available.
- New core operational records capture actor role and branch context where applicable; historical records and remaining administrative modules still need coverage. Sensitive credentials/tokens must never enter audit values.

## 9. Missing tests

- Remaining endpoint-level authorization cases for future payment/chat/audit/customer modules and privileged session administration.
- Voucher concurrency, issue/override behavior, and browser-level staff/portal behavior remain unverified. Rider administration, chat, COD reconciliation, audit filtering, and the admin-order projection have database-backed coverage.
- Browser/device checks listed in `walkthrough.md` remain manual and unverified.

## 10. Migration risks

- Converting globally unique user email plus one tenant/role into tenant memberships can affect login lookup and historical ownership.
- Existing branch-role data must be backfilled without widening branch access.
- New required fields should be nullable/backfilled before constraints are tightened.
- Enum changes require controlled production migrations; local `prisma db push` is not a production rollout strategy.
- Status enums currently contain some order/delivery overlap. Compatibility should be preserved while APIs move toward separated business, delivery, and payment states.
- Refresh tokens created before hashed storage cannot be used after this security change; users with those development-era tokens must sign in again.

## Incremental implementation order

1. Authentication/RBAC and the initial staff-management milestone are implemented and automatically verified; complete their pending browser checks.
2. COD reconciliation is implemented and automatically verified; complete its browser checks and tenant-wide dashboard later.
3. Complete audit coverage/viewing, then transactional voucher limits.
4. Continue with issues/overrides, notifications, editors, reports, and production readiness in the order defined by `oveview.md`.

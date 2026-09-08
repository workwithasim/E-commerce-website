# Verification walkthrough

## Completed automated checks

- Frontend production build and backend TypeScript build.
- 13 regression tests: authoritative pricing, required/foreign/duplicate options, invalid quantities, missing branches, unsupported order modes, delivery discounts, voucher expiry/minimums, status transitions, anonymous access, tenant mismatch, customer ownership, rider ownership, branch scope, and Socket.IO room isolation.
- Database-backed verification using a temporary tenant: signed-in checkout with options, percentage voucher and tax; kitchen preparation; rider assignment and acceptance; pickup; on-the-way; location update; delivery; status history; password-field exclusion; separate-customer and cross-tenant rejection.
- Backend startup and PostgreSQL health.

## Manual browser checks still pending

No browser was connected to the automation runtime. These are checks to perform, not claimed results.

1. Open the React application on port 5173. Verify menu cards, categories, banners, and prices on desktop and a narrow mobile viewport.
2. Add an item with required options. Open the cart, change quantities, and check the signed-in server quote. Apply a valid and invalid voucher.
3. Submit a COD delivery order. Confirm the order number, total, and history. Place a pickup order and confirm no delivery fee.
4. Switch restaurants. Verify branding/content changes, separate carts and branches, and sign-out for a user belonging to another tenant.
5. Log in as kitchen staff assigned to the selected branch. Move the order from pending to preparing to ready. Other branches must not appear.
6. As tenant admin, assign an available rider to the ready delivery.
7. As that rider, accept, pick up, and start delivery. Enable location sharing and approve device permission. Confirm the customer sees incoming locations; stop sharing and confirm updates stop.
8. Mark delivered. Confirm order and delivery statuses agree and the customer history includes the transition.
9. Sign in as another customer. Confirm the previous customer's order is inaccessible.
10. Check keyboard navigation, dialog dismissal, mobile controls, and location-permission denial.

Use separate browser profiles for customer, kitchen, and rider sessions. The demo seed grants kitchen staff an explicit branch membership; orders from another branch belong to that branch's staff.

# Verification walkthrough

## Completed automated checks

- Frontend production build and backend TypeScript build.
- 20 regression tests: the previous pricing, lifecycle, ownership, branch, Socket.IO, and session checks plus combined-role permissions, cross-tenant role-assignment rejection, normalized tenant-admin assignment, assigned-branch scope, and support/payment separation.
- Database-backed verification using a temporary tenant: the ordering/delivery/ownership/session flow plus staff invitation, password activation, staff login, role/branch change, deactivation rejection, refresh revocation, and staff audit creation.
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
11. Leave a signed-in browser open past access-token expiry. Confirm the next API request refreshes once without losing the active view; then log out and confirm the revoked refresh token cannot restore the session.
12. Visit each role-specific login URL and verify an account without the required role is rejected before a session is stored.
13. As tenant admin, create an invited kitchen employee, open the development invitation path, set a password, sign in through `/staff/login`, change branches/role, then deactivate the employee and confirm access is denied.
14. Open the Riders tab, edit a rider's branch/vehicle/registration/zone, save, and confirm delivery history and recent activity render. This browser check is pending because no connected browser was discovered.
15. Open an admin order's Full details dialog. Verify customer/items/financial/kitchen/rider/payment/timeline sections, keyboard focus/dismissal, and narrow-screen layout. Confirm a customer request to `/api/v1/orders/admin/:id` receives 403. API authorization is verified; visual behavior remains pending.
16. Exchange messages as the owning customer, authorized staff, and assigned rider during an active delivery. Confirm realtime arrival, system-message styling, unrelated-customer denial, rider cutoff after delivery, and that internal notes appear only in the admin detail. API/database authorization is verified; browser realtime behavior remains pending.

Use separate browser profiles for customer, kitchen, and rider sessions. The demo seed grants kitchen staff an explicit branch membership; orders from another branch belong to that branch's staff.

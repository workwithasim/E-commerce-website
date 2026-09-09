# WHITE-LABEL MULTI-TENANT RESTAURANT PLATFORM

## NEXT DEVELOPMENT PHASE — COMPLETE AUTHENTICATION, ADMIN OPERATIONS, STAFF MANAGEMENT, CUSTOMER ACCOUNTS, COMMUNICATION, PAYMENTS & AUDIT

You are continuing development of an EXISTING white-label, multi-tenant restaurant platform.

DO NOT treat this as a greenfield project.

DO NOT rebuild features that already exist and pass verification.

Before making any architectural or database change, inspect:

```text
PRD.md
IMPLEMENTATION.md
readmeimportant.md
walkthrough.md
Prisma schema
existing REST routes
auth middleware
Socket.IO authorization
React routes/views
existing order lifecycle
existing rider workflow
existing kitchen workflow
existing tests
```

The existing implementation must remain functional while the platform is expanded.

## Current expansion status (2026-09-09)

The required pre-coding gap analysis is recorded in `GAP_ANALYSIS.md`. Phases A–D are implemented and automatically verified through the current milestones: sessions/RBAC, staff/rider management, complete core admin order detail, secure customer/staff/active-rider chat, and staff-only audited internal notes. Browser checks, COD reconciliation, and controlled production migrations remain pending. Verified details belong in `IMPLEMENTATION.md`; this document remains the target specification.

---

# 1. CURRENT VERIFIED PLATFORM BASELINE

The following features already exist and must be preserved.

## Multi-tenancy

Already implemented:

* Multiple restaurant tenants
* Tenant-specific storefronts
* Tenant-specific branding
* Tenant-specific menus
* Tenant-specific banners
* Tenant-specific categories
* Tenant-specific branches
* Tenant-isolated carts
* Tenant authorization
* Tenant-aware WebSocket connections
* Cross-tenant access rejection

DO NOT redesign this unless an actual security or architecture defect is found.

---

# 2. CUSTOMER STOREFRONT — ALREADY IMPLEMENTED

Customers can already:

* Browse without authentication
* View restaurant-specific menu
* View products and pricing
* Select product options
* Add products to cart
* Maintain tenant-specific carts
* Select branches
* Sign in
* Request server-calculated quote
* Place COD orders
* View personal order history
* Track their own orders

Existing customer ownership checks must remain intact.

---

# 3. SERVER-AUTHORITATIVE PRICING — ALREADY IMPLEMENTED

The backend already validates and calculates:

```text
product pricing
options
quantities
discounts
voucher rules currently supported
tax
delivery fee
total
```

Client-supplied prices are ignored.

DO NOT move authoritative pricing back into frontend clients.

The server must remain the source of truth.

---

# 4. ORDER AUTHORIZATION — ALREADY IMPLEMENTED

Existing protections include:

```text
JWT authentication
tenant ownership
customer ownership
rider assignment ownership
branch staff membership
Socket.IO room authorization
private order subscriptions
```

These protections must remain intact and must be extended to every new module.

---

# 5. KITCHEN WORKFLOW — ALREADY IMPLEMENTED

Kitchen workflow currently supports branch-authorized staff processing orders.

Existing workflow includes:

```text
pending
→ preparing
→ ready
```

and related order lifecycle updates.

Do not replace this working workflow.

Extend it with:

```text
staff identity visibility
staff activity records
better admin monitoring
kitchen timing metrics
internal notes
complete audit coverage
```

---

# 6. RIDER WORKFLOW — ALREADY IMPLEMENTED

Existing rider functionality includes:

```text
rider assignment
saved availability
assignment ownership
acceptance
pickup
on-the-way
browser geolocation publishing
customer location display
delivery completion
```

A database integration test already verified:

```text
quote
→ checkout
→ kitchen
→ rider assignment
→ rider acceptance
→ pickup
→ on-the-way
→ location update
→ delivered
```

Do NOT rebuild this lifecycle.

Extend it into a complete rider management and dispatch system.

---

# 7. REALTIME — ALREADY IMPLEMENTED

Socket.IO already supports private authenticated functionality.

Existing security includes:

```text
authenticated connections
tenantSlug association
server-selected staff/rider rooms
customer order ownership validation
no public kitchen room
no unauthenticated location publishing
```

Any new realtime feature must use the same security model.

---

# 8. CURRENT PAYMENT STATUS

COD is currently implemented.

Online payment processing and refunds are NOT implemented.

Do not advertise:

```text
Stripe
card payment
wallet
online refund
```

until real providers are connected.

However, architecture should allow them later.

---

# 9. PURPOSE OF THIS DEVELOPMENT PHASE

The current web platform already handles the core ordering lifecycle.

The next phase must transform it into a COMPLETE restaurant operating platform.

The main requirement is:

> An authorized Restaurant Admin must be able to see and manage virtually every operational aspect of their restaurant from one administrative system.

This includes:

```text
Customers
Staff
Branches
Kitchen
Riders
Orders
Delivery
Payments
COD
Communication
Promotions
Menu
Reports
Audit History
Settings
```

---

# 10. LOGIN ARCHITECTURE

The platform needs clearly defined role-specific login experiences.

Use the existing authentication foundation wherever possible.

Recommended routes:

```text
/
Customer restaurant website

/login
Customer login

/register
Customer registration

/account
Customer account

/admin/login
Restaurant Admin login

/admin
Restaurant Admin dashboard

/staff/login
Restaurant staff login

/kitchen
Kitchen dashboard

/branch
Branch Manager dashboard

/rider/login
Rider login

/rider
Rider dashboard

/platform/login
Platform Super Admin login

/platform
Platform Super Admin dashboard
```

Do NOT build separate incompatible authentication databases for each portal.

Use one identity foundation with role/tenant/branch authorization.

---

# 11. AUTHENTICATION MODEL

Inspect the current database first.

If current architecture already supports equivalent functionality, extend it instead of replacing it.

Conceptually, authentication should support:

```text
User
↓
Role Assignment
↓
Tenant
↓
Optional Branch Scope
↓
Permissions
```

A user may potentially hold multiple role assignments.

Do NOT make the entire system depend on one permanent:

```text
users.role
```

field if doing so prevents multiple roles or branch scopes.

Preferred conceptual relationship:

```text
User
├── Tenant Membership
│
├── Role
│
├── Permission
│
└── Branch Membership
```

---

# 12. REQUIRED USER TYPES

Support the following operational roles.

## Customer

Public user.

Can:

```text
browse
register
login
manage account
place orders
view own order history
track own orders
view rider tracking for active authorized delivery
communicate about own orders
```

---

## Restaurant Admin

Tenant-wide administrator.

Can manage:

```text
all tenant branches
customers
staff
kitchen operations
riders
orders
menu
promotions
payments
COD
reports
settings
communications
audit records
```

Restaurant Admin must never automatically access another tenant.

---

## Branch Manager

Restricted to assigned branches.

Can manage permitted branch operations including:

```text
orders
branch staff
kitchen
rider assignment
branch availability
branch reports
customers related to branch operations
```

---

## Kitchen Manager

Can manage authorized kitchen operations.

---

## Kitchen Staff

Can process orders for explicitly assigned branches only.

---

## Dispatcher / Delivery Manager

Can manage:

```text
ready delivery orders
rider availability
rider assignments
delivery problems
```

---

## Rider

Can access:

```text
own profile
own availability
assigned deliveries
active delivery
location publishing
own delivery history
COD collection tasks where applicable
```

---

## Support Staff

Optional operational role.

Can access permitted:

```text
customer communication
order lookup
order support
```

without automatically receiving full administrative permissions.

---

## Platform Super Admin

Controls the SaaS/platform itself.

This role is different from Restaurant Admin.

---

# 13. ADMIN-CONTROLLED STAFF CREATION

This is a major required feature.

Restaurant employees must NOT publicly register themselves as privileged users.

Restaurant Admin must be able to create/invite staff.

Admin flow:

```text
Admin
→ Staff
→ Add Staff
```

Fields:

```text
Full Name
Email
Phone
Role
Branch
Multiple branches if allowed
Employee ID optional
Status
```

Possible role choices:

```text
Restaurant Admin
Branch Manager
Kitchen Manager
Kitchen Staff
Dispatcher
Support Staff
Rider
```

Tenant must always come from the authenticated admin context.

Never trust a tenant selection supplied by the frontend.

---

# 14. STAFF INVITATION FLOW

Preferred flow:

```text
Admin creates staff
↓
Staff account created as invited/pending
↓
Secure invitation
↓
Staff creates password
↓
Account activated
↓
Role + branch memberships become effective
```

If email integration is not configured yet, build a development-safe invitation mechanism without pretending email was delivered.

Never generate or expose plaintext employee passwords as a production workflow.

---

# 15. STAFF MANAGEMENT SCREEN

Admin needs:

```text
Staff list
Search
Filter by role
Filter by branch
Filter by status
Create
Edit
Deactivate
Reactivate
Change role
Change branches
View operational activity
Revoke sessions when supported
```

Staff profile should show:

```text
Name
Email
Phone
Role(s)
Assigned branch(es)
Status
Created date
Last login
Recent operational activity
```

---

# 16. RIDER MANAGEMENT

Extend existing riders into full management.

Admin/authorized managers must be able to:

```text
Create rider
Edit rider
Activate/deactivate rider
Assign branch
Assign delivery zone
View availability
View current delivery
View delivery history
View COD accountability
View recent operational activity
```

Rider profile may include:

```text
Name
Phone
Email
Vehicle type
Vehicle registration
Branch
Zone
Status
Availability
Last active time
Current assignment
```

---

# 17. RIDER LOGIN

Rider should have dedicated login experience.

Initial implementation may use existing email/password authentication.

Future architecture may support:

```text
phone + OTP
```

Do not implement fake OTP.

Rider must never see:

```text
other riders' private assignments
unrelated customer records
admin reports
unrelated tenant data
```

---

# 18. CUSTOMER ACCOUNT EXPANSION

Extend current customer functionality.

Customer account should include:

```text
Profile
Addresses
Order history
Current orders
Track order
Payment information
Messages
Logout
```

Optional later:

```text
Favorites
Loyalty
Saved payment methods
```

---

# 19. OLD CUSTOMER MIGRATION SUPPORT

The platform must support existing restaurant customers.

When migrating an existing restaurant, preserve where possible:

```text
customer identity
phone
email
addresses
historical orders
order items
order totals
order dates
payment history
voucher/loyalty history
```

Existing users should not lose historical records.

If old password hashes cannot safely be migrated, provide secure password reset/account activation rather than attempting insecure conversion.

---

# 20. COMPLETE CUSTOMER ORDER HISTORY

Customer order history must show:

```text
Order number
Order date
Branch
Order type
Items
Total
Payment method
Payment status
Order status
Delivery status
```

Clicking an order opens full customer-safe details.

Never expose internal notes or administrative audit data to customers.

---

# 21. REORDER

Add a Reorder feature.

When customer chooses Reorder:

Do NOT simply copy historical totals.

Revalidate:

```text
product still exists
product is active
branch availability
current price
current options
current modifiers
current stock/availability
```

Then create a new current cart.

---

# 22. ADMIN CUSTOMER MANAGEMENT

Restaurant Admin needs complete customer management.

Admin customer list:

```text
Search by name
Search by phone
Search by email
Search by order number
Filter by status
```

Customer profile:

```text
Name
Email
Phone
Account status
Addresses
Registration date
Total orders
Total spend
Last order
Order history
Refund history where applicable
Voucher usage
Support/order conversations
```

Admin should be able to deactivate customer access without deleting historical orders.

---

# 23. COMPLETE ADMIN ORDER DETAIL PAGE

This is one of the highest-priority features.

Admin should open one order and understand the complete story.

Order page:

## General

```text
Order number
Tenant
Branch
Created at
Customer
Order type
Order status
Delivery status
Payment status
```

## Customer

```text
Customer name
Phone
Email
Delivery address
Delivery instructions
Previous order count
```

## Items

```text
Product
Variant
Options
Modifiers
Quantity
Unit price
Discount
Line total
Customer notes
```

## Financial

```text
Subtotal
Voucher
Discount
Tax
Delivery fee
Total
Currency
Paid amount
Outstanding amount
Refund amount
```

## Kitchen

```text
Received time
Accepted time
Accepted by
Preparation started time
Started by
Ready time
Ready by
Preparation duration
Internal kitchen notes
```

## Rider/Delivery

```text
Assigned rider
Assigned time
Accepted time
Pickup time
On-the-way time
Delivered time
Delivery duration
Current location while active
Delivery problem reports
```

## Payment

```text
Method
Status
Provider/reference if applicable
COD expected
COD collected
Collected by
Collected at
Settlement status
```

## Communication

```text
Customer messages
Rider messages
Support messages
System messages
```

## Timeline

Chronological complete lifecycle.

---

# 24. UNIFIED ORDER TIMELINE

Use/extend existing order lifecycle audit data.

Admin timeline example:

```text
19:12:02
Customer created Order #1234

19:12:03
Server quote validated
PKR 2,450

19:14:08
Ahmed confirmed order
Branch Manager

19:16:12
Bilal started preparation
Kitchen Staff

19:31:45
Bilal marked order Ready

19:33:02
Hassan assigned as rider

19:33:40
Hassan accepted delivery

19:36:21
Hassan picked up order

19:37:01
Delivery started

19:52:10
Delivery completed

19:52:15
COD PKR 2,450 recorded as collected
```

Where lifecycle events already exist, reuse them.

Do NOT create another disconnected timeline system unless necessary.

---

# 25. ACTOR RECORDING

Every important lifecycle event must record who performed it.

Example:

```text
actorUserId
actorRole
tenantId
branchId
timestamp
action
entity
entityId
metadata
```

Admin should be able to answer:

```text
Who confirmed this order?
Who started preparation?
Who marked it ready?
Who assigned the rider?
Which rider accepted it?
Who manually changed status?
Who marked COD collected?
```

---

# 26. KITCHEN ADMIN MONITORING

Admin needs live kitchen visibility.

Admin dashboard should show:

```text
New orders
Preparing
Ready
Delayed
Average preparation time
Orders handled by branch
```

Authorized admin can drill into a ticket.

Do not interfere with existing kitchen branch isolation.

---

# 27. KITCHEN STAFF ACTIVITY

Track operational actions, not invasive surveillance.

Staff profile may show:

```text
Orders touched today
Orders started
Orders marked ready
Recent kitchen events
Average preparation metrics where meaningful
```

The goal is operational accountability.

---

# 28. INTERNAL NOTES

Implement internal order notes.

Example:

```text
"Customer called branch and approved replacement."
```

Internal notes may be visible to permitted staff/admin.

They MUST NOT be returned from customer-facing order APIs.

---

# 29. ORDER COMMUNICATION / CHAT

Add secure order-specific communication.

Recommended participants:

```text
Customer
Authorized branch/support staff
Assigned rider
```

Do not expose kitchen employee phone numbers.

If customer communication needs kitchen involvement, route through staff/support/order conversation.

---

# 30. MESSAGE MODEL

Conceptually:

```text
Message
-------
id
tenantId
orderId
conversationId
senderUserId
senderRole
message
createdAt
readAt
```

All message access must check:

```text
tenant
order authorization
customer ownership
staff permission
rider assignment
```

---

# 31. SYSTEM MESSAGES

Order conversation/timeline may include system messages:

```text
Order confirmed
Kitchen started preparation
Order ready
Rider assigned
Rider picked up order
Order delivered
```

Clearly distinguish system events from human messages.

---

# 32. RIDER/CUSTOMER CHAT

During appropriate delivery stages, customer and assigned rider can communicate.

Examples:

```text
Customer:
"Please call when outside."

Rider:
"I am near your location."
```

When rider assignment ends, access policy must be re-evaluated.

Do not give riders permanent access to arbitrary customer conversations.

---

# 33. ADMIN CHAT VISIBILITY

Authorized Restaurant Admin/support personnel can inspect relevant order conversations for:

```text
support
dispute handling
delivery problems
customer service
```

Access must be auditable if necessary.

---

# 34. COD FINANCIAL TRACKING

Current COD support must be expanded into operational accountability.

Track:

```text
Expected amount
Amount collected
Collected by rider
Collection timestamp
Settlement status
Settlement timestamp
Received by restaurant
Difference/dispute
```

Recommended COD states:

```text
pending_collection
collected_by_rider
pending_settlement
settled
disputed
```

This must remain separate from:

```text
order status
delivery status
```

---

# 35. PAYMENT STATUS

Maintain separate payment status.

Conceptually:

```text
unpaid
pending
paid
failed
partially_refunded
refunded
```

Current COD implementation may map into this architecture.

Do not implement fake online payments.

---

# 36. DELIVERY STATUS

Continue using a separate delivery lifecycle.

Target structure may include:

```text
unassigned
assigned
accepted
arrived_at_restaurant
picked_up
en_route
arrived_at_customer
delivered
failed
cancelled
```

Before changing current enum/state logic, inspect existing implementation and preserve compatibility.

---

# 37. ORDER STATUS

Order lifecycle remains independent from payment/delivery.

Example conceptual business lifecycle:

```text
pending
confirmed
preparing
ready
completed
cancelled
rejected
```

Do not merge delivery/payment semantics into one overloaded status.

---

# 38. RBAC EXPANSION

Current authorization must evolve into comprehensive role/permission management.

Example permissions:

```text
orders.view
orders.manage
orders.cancel
orders.override

customers.view
customers.manage

staff.view
staff.create
staff.edit
staff.disable

branches.view
branches.manage

kitchen.view
kitchen.process
kitchen.manage

riders.view
riders.manage
riders.assign

delivery.view
delivery.manage

payments.view
payments.manage
payments.refund

communications.view
communications.respond

reports.view
settings.manage
audit.view
```

Avoid spreading:

```js
if (role === "admin")
```

across the codebase.

Use reusable permission middleware/policies.

---

# 39. ADMIN PERMISSIONS

Restaurant Admin should have tenant-wide access by default unless tenant policy says otherwise.

Restaurant Admin can see:

```text
All tenant branches
All tenant orders
All tenant customers
All tenant staff
All tenant riders
All kitchen activity
All delivery activity
All authorized payments
All conversations
All reports
All tenant audit logs
All tenant settings
```

This MUST NOT bypass tenant isolation.

---

# 40. BRANCH MANAGER PERMISSIONS

Branch Manager can only see assigned branches.

Example:

```text
Branch Manager: Ahmed

Memberships:
F-7
G-11
```

Ahmed may see permitted data in those branches.

He must not automatically see:

```text
Saddar
Rawalpindi
Lahore
```

unless explicitly assigned.

---

# 41. PLATFORM SUPER ADMIN

Platform Super Admin manages the SaaS itself.

Capabilities:

```text
Tenant list
Create tenant
Configure tenant
Suspend tenant
Domains
Brand configuration
Platform plans/licenses
Platform usage
Platform health
Global integrations
Platform audit
```

Platform Super Admin must not be treated as an ordinary restaurant employee.

---

# 42. ADMIN DASHBOARD

Expand the current basic analytics dashboard.

Top metrics:

```text
Orders today
Revenue today
Pending
Preparing
Ready
Out for delivery
Delivered
Cancelled
Failed deliveries
Active riders
Available riders
Active kitchen tickets
Average preparation time
Average delivery time
```

Revenue must remain grouped by currency.

Do not sum multiple currencies into one meaningless figure.

---

# 43. GLOBAL ADMIN ORDER SEARCH

Search:

```text
Order number
Customer name
Customer phone
Email
Rider
Branch
Payment reference
```

Filters:

```text
Date range
Branch
Order status
Delivery status
Payment status
Payment method
Rider
Order type
```

---

# 44. ADMIN STAFF SEARCH

Search/filter:

```text
Name
Phone
Email
Role
Branch
Status
```

---

# 45. RIDER DISPATCH SCREEN

Extend existing assignment workflow.

Dispatcher/admin view:

```text
Ready delivery orders
Available riders
Busy riders
Offline riders
Current rider assignments
Delivery age
Branch
Customer area
```

Assignment must remain server-authorized.

---

# 46. REALTIME ADMIN OPERATIONS

Use existing Socket.IO infrastructure.

Potential realtime admin events:

```text
new order
order confirmed
preparation started
order ready
rider assigned
rider accepted
pickup
rider location
delivery completed
payment updated
new message
```

Never create insecure globally subscribed rooms.

---

# 47. NOTIFICATION ABSTRACTION

Build internal notification system first.

Support:

```text
in-app notification
```

Architecture may later integrate:

```text
email
SMS
WhatsApp
push notification
```

Do not advertise providers until connected.

---

# 48. AUDIT LOG EXPANSION

Current order lifecycle audit entries already exist.

Extend audit coverage to:

```text
staff created
staff disabled
staff role changed
branch assignment changed
product created
price changed
stock changed
branch opened/closed
voucher created
voucher changed
order manually overridden
rider changed
payment changed
COD settlement changed
settings changed
customer account disabled
```

Prefer append-only operational audit history.

---

# 49. AUDIT VIEWER

Admin needs Audit Logs page.

Filters:

```text
Date
Actor
Role
Branch
Action
Entity type
Entity ID
```

Audit record detail should show appropriate:

```text
who
what
when
where
previous state
new state
```

Do not expose passwords, access tokens or payment secrets.

---

# 50. SESSION MANAGEMENT

Current refresh-token lifecycle is incomplete.

Implement properly.

Support:

```text
access token
refresh token
refresh expiration
rotation
logout
revocation
disabled-user enforcement
```

Important privileged roles should later support:

```text
2FA
device/session list
force logout
```

Do not weaken current authentication while implementing refresh.

---

# 51. STAFF DISABLE

When admin disables a staff member:

```text
new login blocked
refresh should fail
active sessions should be revoked/invalidated where possible
new operational actions denied
```

Do not delete historical actions performed by the employee.

---

# 52. CUSTOMER DISABLE

When customer account is disabled:

```text
new authentication denied
historical orders retained
financial records retained
audit records retained
```

---

# 53. VOUCHER REDEMPTION LIMITS

Current server correctly rejects unsupported usage-limited vouchers.

Now implement real redemption limits.

Support:

```text
global usage limit
per-customer usage limit
valid from
valid until
minimum order
maximum discount
tenant scope
branch applicability
product/category applicability where supported
```

Voucher usage must be recorded transactionally with order creation.

Prevent race-condition over-redemption.

---

# 54. MENU OPTION ADMINISTRATION

Current menu/product option validation already exists.

Build complete admin editors for:

```text
Categories
Products
Variants
Option groups
Modifiers
Required selections
Minimum selections
Maximum selections
Branch availability
Branch price overrides
```

Do not break existing database-ID based selection validation.

---

# 55. SETTINGS ADMINISTRATION

Expand current branding/settings support.

Tenant settings may include:

```text
Restaurant name
Logo
Colors
Contact
Currency
Timezone
Locale
Delivery rules
Order modes
Tax configuration
Business hours
Notification settings
Brand assets
```

Configuration must remain tenant-specific.

---

# 56. BRANCH MANAGEMENT

Admin needs comprehensive branch editor:

```text
Name
Address
Phone
Coordinates
Opening status
Business hours
Delivery enabled
Pickup enabled
Delivery zone
Minimum order
Delivery fee rules
Branch staff
Branch riders
```

Current branch authorization must remain intact.

---

# 57. ADVANCED CUSTOMER TRACKING EXPERIENCE

Existing customer tracking already receives order/location updates.

Improve UI to show:

```text
Order received
Confirmed
Preparing
Ready
Rider assigned
Picked up
On the way
Delivered
```

Show actual timestamps where existing data provides them.

Do not invent timestamps.

---

# 58. LIVE RIDER MAP

Current customer OpenStreetMap coordinate display exists.

Improve UX while preserving permission rules.

Display when authorized:

```text
restaurant/branch
customer destination
current rider position
```

Location sharing must:

```text
require active authorized delivery
require rider permission
stop appropriately after delivery
```

---

# 59. ADMIN LIVE RIDER VIEW

Authorized Admin/Dispatcher should be able to see active rider locations during active deliveries.

Do not build long-term continuous employee tracking unrelated to deliveries.

Operational location visibility should be limited to legitimate delivery purposes.

---

# 60. REPORTS

Expand analytics gradually.

Required operational reports:

```text
Sales
Orders
Branches
Products
Customers
Kitchen
Riders
Delivery
COD
Payments
Vouchers
```

Always respect:

```text
tenant
branch permissions
currency
date ranges
```

---

# 61. SALES REPORT

Include:

```text
Gross sales
Discounts
Delivery fees
Taxes
Net/recognized revenue according to chosen accounting rule
Order count
Average order value
Cancelled orders
```

Define revenue logic explicitly.

Do not count cancelled/unpaid orders as revenue without deliberate rules.

---

# 62. KITCHEN REPORT

Potential metrics:

```text
Orders received
Orders completed
Average preparation duration
Delayed orders
Peak hours
Branch comparison
```

---

# 63. RIDER REPORT

Potential metrics:

```text
Assignments
Accepted
Delivered
Failed
Average delivery duration
COD collected
COD settlement state
```

---

# 64. ORDER ISSUE HANDLING

Add operational issue/report mechanism.

Examples:

```text
Customer unreachable
Wrong address
Item unavailable
Kitchen delay
Rider breakdown
Payment issue
Delivery failed
Customer complaint
```

Record:

```text
type
order
actor
notes
timestamp
status/resolution
```

---

# 65. MANUAL ORDER OVERRIDES

Restaurant Admin may occasionally need to override business states.

Any privileged override must:

```text
require permission
require reason
record previous state
record new state
record actor
record timestamp
create audit entry
```

Never silently modify an order state.

---

# 66. DATA PRIVACY

Different roles must receive different fields.

Customer APIs must not expose:

```text
internal notes
staff private data
audit metadata
other customers
```

Rider APIs should only expose customer information required to deliver the active order.

Kitchen should only receive information required for preparation.

Admin access remains tenant-authorized.

---

# 67. DATABASE CHANGES

Before creating models:

Inspect current Prisma schema.

Reuse existing models whenever reasonable.

Do NOT create duplicate concepts like:

```text
OrderAudit
OrderHistory
OrderTimeline
LifecycleEvent
```

if an existing model already represents the same information.

Normalize/extend rather than duplicate where appropriate.

---

# 68. MIGRATIONS

Current development uses:

```text
prisma db push
```

for local development.

Before production deployment introduce proper controlled migrations.

Do not treat `db push` as the final production migration strategy.

Seed must remain demo/development only.

Do not run destructive seed behavior against production.

---

# 69. EXISTING HISTORICAL DEMO

The root:

```text
index.html
js/
css/
```

is historical standalone demo code.

Do not add new production business functionality there.

The maintained application is:

```text
client/
server/
```

---

# 70. TESTING — DO NOT REMOVE EXISTING TESTS

All current regression tests must remain passing.

Currently verified:

```text
13 regression tests
client production build
server build
database integration flow
git diff --check
start.sh syntax
```

New functionality must add tests rather than replacing meaningful existing coverage.

---

# 71. REQUIRED NEW AUTHORIZATION TESTS

Add tests proving:

```text
customer cannot access admin
customer cannot access another customer order
rider cannot access another rider delivery
kitchen staff cannot access another branch
branch manager cannot access unassigned branch
tenant admin cannot access another tenant
disabled employee cannot perform operations
support staff cannot access payment-management APIs without permission
```

---

# 72. STAFF MANAGEMENT TESTS

Test:

```text
admin creates staff
admin assigns branch
admin changes role
admin deactivates staff
deactivated staff rejected
staff actions audited
```

---

# 73. CHAT TESTS

Verify:

```text
customer can access own order chat
customer cannot access another order chat
assigned rider can access authorized chat
unrelated rider denied
staff permission required
cross-tenant chat denied
```

---

# 74. COD TESTS

Verify:

```text
COD order expected amount
rider collection
settlement status
duplicate collection protection
unauthorized COD update denied
```

---

# 75. VOUCHER LIMIT TESTS

Verify:

```text
global redemption limit
per-customer limit
expired voucher
minimum purchase
tenant scope
concurrent redemption safety
```

---

# 76. SESSION TESTS

Test:

```text
access token expiry
valid refresh
rotated refresh token
revoked refresh token
logout
disabled user
cross-tenant role/session behavior
```

---

# 77. BROWSER VERIFICATION

Manual browser checks are currently pending.

After implementing this phase, explicitly verify:

```text
customer desktop
customer mobile
admin desktop
branch manager
kitchen tablet size
rider mobile
chat
live location
modal/dialog keyboard behavior
permission errors
loading states
empty states
```

Do not mark these as complete until actually verified.

---

# 78. DO NOT CLAIM UNVERIFIED FEATURES

Existing documentation correctly distinguishes:

```text
implemented
automatically tested
manually verified
pending
```

Maintain this discipline.

Do not mark a feature complete because:

```text
code exists
TypeScript compiles
UI exists
```

A feature is complete only after meaningful relevant verification.

---

# 79. DOCUMENTATION

Update:

```text
PRD.md
IMPLEMENTATION.md
readmeimportant.md
walkthrough.md
```

after each significant milestone.

PRD = target product vision.

IMPLEMENTATION.md = what is actually implemented and verified.

Do not mix future vision with current verified behavior.

---

# 80. RECOMMENDED DEVELOPMENT ORDER

Do NOT attempt every remaining feature in one uncontrolled rewrite.

Implement in this order.

## PHASE A — Authentication/RBAC completion

```text
role model
permission model
admin/staff/rider login flows
session refresh/revocation
staff branch assignments
```

Preserve existing customer/JWT authorization.

---

## PHASE B — Admin staff/rider management

```text
staff list
create staff
roles
branches
status
rider profiles
rider availability management
```

---

## PHASE C — Complete admin order view

```text
order summary
customer
items
financials
kitchen
rider
payment
audit timeline
```

This should reuse existing lifecycle/audit data.

---

## PHASE D — Customer/admin communication

```text
order conversation
customer
support
assigned rider
realtime messages
authorization
```

---

## PHASE E — COD reconciliation

```text
collection
rider accountability
settlement
admin reporting
audit
```

---

## PHASE F — Audit completion

Expand audit coverage to all important administrative actions.

---

## PHASE G — Voucher redemption limits

Implement safely and transactionally.

---

## PHASE H — Full settings/menu editors

Build admin UI around existing validated menu concepts.

---

## PHASE I — Analytics/reports

Implement only after transactional data and statuses are stable.

---

## PHASE J — Production readiness

```text
Prisma migrations
environment validation
session security
secret rotation guidance
deployment
HTTPS
CORS
logging
health monitoring
backups
browser/device verification
```

---

# 81. MOST IMPORTANT ADMIN EXPERIENCE

One of the key success criteria is:

Restaurant Admin opens:

```text
Admin
→ Orders
→ Order #1234
```

and sees the complete operational history.

Example:

```text
CUSTOMER
Asim
0300...
Returning customer
5 previous orders

ORDER
#1234
Delivery
PKR 2,450

BRANCH
F-7 Islamabad

KITCHEN
Confirmed by Ahmed at 7:14 PM
Started by Bilal at 7:16 PM
Ready at 7:31 PM

RIDER
Hassan
Assigned 7:33 PM
Accepted 7:34 PM
Picked up 7:36 PM
Delivered 7:52 PM

PAYMENT
Cash on Delivery
PKR 2,450
Collected by Hassan
Settlement Pending

MESSAGES
Customer ↔ Support/Rider conversation

AUDIT
Complete chronological history
```

The admin should NOT need to manually inspect several database tables or disconnected pages to determine what happened.

---

# 82. CUSTOMER SUCCESS EXPERIENCE

Customer should experience:

```text
Restaurant Website
↓
Menu
↓
Product
↓
Cart
↓
Login/Register
↓
Checkout
↓
COD Order
↓
Order Confirmation
↓
Live Kitchen Status
↓
Rider Assigned
↓
Live Rider Location
↓
Order Chat
↓
Delivered
↓
Order stored permanently in history
```

Returning customer:

```text
Login
↓
Account
↓
Historical orders
↓
View details
↓
Reorder if desired
```

---

# 83. KITCHEN SUCCESS EXPERIENCE

Kitchen employee:

```text
Staff Login
↓
Assigned Branch
↓
New Orders
↓
Start Preparing
↓
Ready
```

Admin sees every important kitchen action with:

```text
actor
time
branch
order
```

---

# 84. RIDER SUCCESS EXPERIENCE

Rider:

```text
Login
↓
Availability
↓
Assignment
↓
Accept
↓
Pickup
↓
Start Delivery
↓
Location Sharing
↓
Customer Communication
↓
COD Collection if applicable
↓
Delivered
↓
Delivery History
```

---

# 85. RESTAURANT ADMIN SUCCESS EXPERIENCE

Restaurant Admin:

```text
Login
↓
Dashboard
├── Orders
├── Customers
├── Staff
├── Branches
├── Kitchen
├── Riders
├── Dispatch
├── Payments
├── COD
├── Communication
├── Menu
├── Promotions
├── Reports
├── Audit
└── Settings
```

Restaurant Admin should have full visibility within their own tenant while tenant isolation remains absolute.

---

# 86. PLATFORM SUPER ADMIN SUCCESS EXPERIENCE

Platform Super Admin:

```text
Platform Login
↓
Tenants
↓
Restaurant A
Restaurant B
Restaurant C
```

Can manage platform-level configuration without adding restaurant-specific code.

---

# 87. NON-NEGOTIABLE DEVELOPMENT RULES

1. Do not rebuild features already verified unless they are genuinely defective.

2. Do not break the existing 13 regression tests.

3. Do not hard-code restaurant brands.

4. Do not trust frontend pricing.

5. Do not trust frontend tenant IDs for authorization.

6. Do not expose another customer's order.

7. Do not expose another tenant's data.

8. Do not allow branch staff tenant-wide access by default.

9. Do not allow riders access to unrelated deliveries.

10. Do not expose internal staff notes to customers.

11. Do not implement fake online payments.

12. Do not implement fake OTP.

13. Do not claim manual browser/device verification unless it was actually performed.

14. Reuse existing lifecycle, authorization, pricing and realtime architecture wherever appropriate.

15. Make changes incrementally and test after each milestone.

---

# 88. BEFORE CODING

First perform a gap analysis.

Produce:

```text
1. Existing models/routes/components that already satisfy this specification.

2. Existing functionality that only needs UI exposure.

3. Existing functionality that needs extension.

4. Missing database entities.

5. Missing API endpoints.

6. Missing frontend routes/screens.

7. Missing permission rules.

8. Missing audit events.

9. Missing tests.

10. Potential migration risks.
```

Then implement incrementally.

Do NOT start by rewriting authentication or database architecture without first proving the current implementation cannot support the required extension.

---

# 89. AFTER EACH PHASE

Run relevant checks.

At minimum preserve:

```text
client npm run build
server npm run build
server npm test
integration test where applicable
git diff --check
```

Add new targeted regression/integration tests.

Update IMPLEMENTATION.md with only verified claims.

---

# 90. FINAL PRODUCT PRINCIPLE

This product must operate as:

```text
CUSTOMER
     ↓
ORDER
     ↓
BRANCH
     ↓
KITCHEN
     ↓
RIDER / PICKUP
     ↓
DELIVERY
     ↓
PAYMENT
     ↓
COMMUNICATION
     ↓
AUDIT / REPORTING
```

All of these belong to one tenant-aware, role-aware, server-authoritative platform.

The end result must not merely be a food ordering website.

It must be a complete restaurant operations platform capable of powering multiple restaurant brands from the same codebase.

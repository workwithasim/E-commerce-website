# WHITE-LABEL MULTI-TENANT RESTAURANT PLATFORM

## Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Master Development Specification  
**Product Type:** White-label, multi-tenant food ordering and restaurant operations platform  
**Primary Goal:** Build one reusable platform that can power multiple restaurant brands, branches, websites, mobile applications, kitchens, riders, and administrative systems from a shared codebase.

---

# 1. PRODUCT VISION

Build a production-grade, configurable restaurant technology platform that can be deployed for different restaurant brands without modifying the application's core business logic.

The platform must support:
* Multiple restaurant brands/tenants
* Multiple branches per restaurant
* Customer web ordering
* Customer Android & iOS applications
* Rider application
* Kitchen application/dashboard
* Branch manager dashboard
* Restaurant admin dashboard
* Platform super-admin dashboard
* Real-time order updates & rider tracking
* Dynamic branding, menus, products, pricing, categories, banners, settings
* Vouchers, promotions, payments, delivery management, analytics, RBAC, audit logs

The system must be **configuration-driven rather than brand-specific**.
The application must never contain hard-coded assumptions such as `if restaurant == "Cheezious"`.

---

# 2. CORE PRODUCT PRINCIPLE

The system is a **platform**, not a Cheezious clone. Cheezious is only one tenant.

```text
Platform
├── Cheezious (Tenant 1)
│   ├── Website / Customer App / Rider App / Kitchen / Admin / Branches
├── Savour Foods (Tenant 2)
│   ├── Website / Customer App / Rider App / Kitchen / Admin / Branches
└── Restaurant C (Tenant 3)
```

Every tenant must have isolated business data and configurable branding.

# 3. IMPLEMENTATION STATUS

The current milestone repairs the existing web implementation. Progress and test evidence are tracked in [IMPLEMENTATION.md](IMPLEMENTATION.md); setup is documented in [readmeimportant.md](readmeimportant.md).

Implemented in the web platform:

- Tenant-specific storefront content, branding, carts, and branches.
- Authenticated customer ordering/history and server-calculated quotes with validated product options.
- Tenant/customer/rider/branch authorization and private order subscriptions.
- Kitchen workflow, rider assignments, saved availability, browser geolocation publishing, customer location display, and synchronized order/delivery statuses.
- Order-lifecycle audit entries, basic administration, and revenue grouped by currency.

Current product decisions:

- Browsing/cart use is anonymous; checkout and tracking require sign-in.
- COD is supported. Online payment options are not advertised until provider integration exists.
- Native applications remain outside this web repair milestone.

Phase A, staff/rider management, and the core complete admin order view are now implemented and automatically verified. The admin order projection reuses existing status/audit data and remains isolated from customer APIs. Browser verification and controlled production migrations remain pending; see `GAP_ANALYSIS.md` and `IMPLEMENTATION.md` for evidence and boundaries.

Not yet complete: native Android/iOS apps, online payments/refunds, production deployment/migrations, complete rider administration, voucher redemption limits, complete audit coverage, comprehensive settings/menu-option administration, and advanced analytics. Visual browser and device-location verification is pending; automated API/database checks do not substitute for it.

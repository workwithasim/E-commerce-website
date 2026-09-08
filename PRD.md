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

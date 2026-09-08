# 🚀 WHITE-LABEL MULTI-TENANT RESTAURANT SAAS PLATFORM

> **Specification:** [PRD.md](file:///home/a4asimkhalid/Desktop/chezzious%20website%20layout%20/PRD.md) (Master PRD v1.0.0)  
> **Architecture Core:** *One Platform. One Codebase. Dynamic Branding. Strict Tenant Isolation. Server-Authoritative Pricing. Real-Time Operations.*  
> **Tech Stack:** **PostgreSQL + Express.js + React.js + Node.js + TypeScript + WebSockets (Socket.io)**  
> **Version:** 4.0.0 (Master White-Label Multi-Tenant Release — No Docker Required)

---

## 📑 TABLE OF CONTENTS
1. [Platform Vision & Core Principles](#1-platform-vision--core-principles)
2. [Multi-Tenant Architecture](#2-multi-tenant-architecture)
3. [Dynamic Branding & Theming Engine](#3-dynamic-branding--theming-engine)
4. [Authoritative Server-Side Pricing Engine](#4-authoritative-server-side-pricing-engine)
5. [7 Role-Based Portals & Default Credentials](#5-7-role-based-portals--default-credentials)
6. [Real-time Socket.io Room Architecture](#6-real-time-socketio-room-architecture)
7. [PostgreSQL Multi-Tenant Database Schema](#7-postgresql-multi-tenant-database-schema)
8. [API Endpoints Reference (V1)](#8-api-endpoints-reference-v1)
9. [How to Launch Locally (No Docker)](#9-how-to-launch-locally-no-docker)
10. [End-to-End Verification Walkthrough](#10-end-to-end-verification-walkthrough)
11. [Git Changelog](#11-changelog)

---

## 1. PLATFORM VISION & CORE PRINCIPLES

This platform is a **configuration-driven SaaS platform**, not a single-brand clone. Cheezious is simply Tenant #1. Another tenant (such as **Savour Foods**) is Tenant #2.

```
                    PLATFORM (Super Admin)
                              │
                    TENANTS (Cheezious, Savour Foods, ...)
                              │
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
       BRANDING            SETTINGS          BUSINESS DATA
    (Colors, Fonts,     (Currency, Tax,     (Products, Branches,
     Logos, Radii)       Delivery Rules)      Orders, Customers)
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                 ┌────────────┴────────────┐
                 ↓                         ↓
          REAL-TIME ENGINE          REST API ENGINE
       (Socket.io Isolated       (Strict Tenant Isolation
         Tenant & Branch          & Server-Authoritative
             Rooms)                      Pricing)
                 │                         │
     ┌───────────┼───────────┬─────────────┼───────────┐
     ↓           ↓           ↓             ↓           ↓
  Customer     Kitchen     Rider        Tenant       Super
 Storefront      KDS     Dashboard       Admin       Admin
 (Dynamic      (Audio      (GPS         (Branding,  (Tenant
  Theming)     Alerts)    Sim & Flow)    Menu, Ops)  Onboard)
```

### Key Rules Enforced:
- **Rule 1 — No Hardcoded Brands:** The codebase contains zero brand assumptions. Colors, slogans, logos, and menus are loaded dynamically.
- **Rule 4 & 6 — Strict Tenant Isolation:** Every database model includes `tenantId`. Non-super-admin users cannot access data across tenants.
- **Rule 5 — Server-Side Pricing Only:** Clients send item IDs and option IDs. The server authoritatively calculates unit prices, discounts, delivery fees, and grand totals.

---

## 2. MULTI-TENANT ARCHITECTURE

The platform comes pre-seeded with two full production-grade restaurant brands:

| Feature | 🍕 Cheezious (Tenant 1) | 🍗 Savour Foods (Tenant 2) |
|---|---|---|
| **Slug** | `cheezious` | `savour-foods` |
| **Primary Color** | `#D80032` (Crimson Red) | `#0B6E4F` (Emerald Forest Green) |
| **Secondary Color** | `#FFE600` (Cheezy Gold) | `#D4AF37` (Royal Gold) |
| **Catalog** | 36 Categories, 129 Authentic Products | Traditional Pulao, Roasts, Zarda Kheer |
| **Customizer Engine** | Pizza Sizes, Crusts, Toppings | Portion Sizes (Single/Double), Piece Types, Kababs |
| **Branches** | 61 Nationwide Branches | Blue Area, Gordon College Rd, Peshawar Rd |
| **Vouchers** | `CHEEZY10`, `WELCOME50`, `SUPERCHEESE` | `SAVOUR10` |

---

## 3. DYNAMIC BRANDING & THEMING ENGINE

The frontend uses **`ThemeProvider.tsx`** to dynamically inject CSS custom properties to `:root`:

```css
:root {
  --color-primary: [tenant.branding.primaryColor];
  --color-secondary: [tenant.branding.secondaryColor];
  --color-accent: [tenant.branding.accentColor];
  --color-surface: [tenant.branding.surfaceColor];
  --color-text: [tenant.branding.textColor];
  --radius-btn: [tenant.branding.buttonRadius];
  --radius-card: [tenant.branding.cardRadius];
}
```

### 1-Click Brand Switcher:
At the top of the screen in development/demo mode, click **🍕 Cheezious** or **🍗 Savour Foods** to watch the entire UI instantaneously rebrand its colors, logos, categories, products, and branches with zero reload.

---

## 4. AUTHORITATIVE SERVER-SIDE PRICING ENGINE

Located at `server/src/services/pricing.ts`:
1. Client sends:
   ```json
   {
     "items": [
       { "productId": "prod_1", "quantity": 2, "optionIds": ["opt_size_large", "opt_crust_cheese"] }
     ],
     "branchId": "branch_1",
     "orderMode": "DELIVERY",
     "voucherCode": "CHEEZY10"
   }
   ```
2. The server queries PostgreSQL for base price and option modifiers.
3. Server authoritatively computes subtotal, verifies voucher rules and minimum order thresholds, applies branch-specific delivery fee, and computes total.
4. Client-sent totals are strictly ignored to prevent tampering.

---

## 5. 7 ROLE-BASED PORTALS & DEFAULT CREDENTIALS

All roles log in from a single unified login page (`LoginPage.tsx`) with 1-click demo buttons:

| Role | Email | Password | Tenant | Portal View |
|---|---|---|---|---|
| **👑 Super Admin** | `superadmin@platform.com` | `SuperAdmin@123` | Platform | Super Admin Dashboard (1-Click Onboarder) |
| **⚡ Cheezious Admin** | `admin@cheezious.com` | `Admin@123` | Cheezious | Visual Branding, Menu Builder, Orders |
| **👨‍🍳 Cheezious Kitchen** | `kitchen@cheezious.com` | `Kitchen@123` | Cheezious | Kitchen Display System with Audio Alert |
| **🛵 Cheezious Rider** | `rider@cheezious.com` | `Rider@123` | Cheezious | Rider Portal with Live GPS Broadcaster |
| **🛒 Cheezious Customer** | `customer@cheezious.com` | `Customer@123` | Cheezious | Cheezious Red/Yellow Customer Storefront |
| **⚡ Savour Admin** | `admin@savour.com` | `Admin@123` | Savour Foods | Savour Branding, Pulao Menu Builder |
| **👨‍🍳 Savour Kitchen** | `kitchen@savour.com` | `Kitchen@123` | Savour Foods | Savour Kitchen Queue with Beeps |
| **🛵 Savour Rider** | `rider@savour.com` | `Rider@123` | Savour Foods | Savour Delivery Dashboard |
| **🛒 Savour Customer** | `customer@savour.com` | `Customer@123` | Savour Foods | Savour Green/Gold Customer Storefront |

---

## 6. REAL-TIME SOCKET.IO ROOM ARCHITECTURE

Located at `server/src/socket.ts`:

| Room | Purpose | Real-Time Events |
|---|---|---|
| `tenant:{tenantId}` | Brand-isolated broadcasts | `product:added`, `product:updated`, `delivery:assigned` |
| `branch:{branchId}` | Branch specific updates | `branch:status_updated` |
| `kitchen:{branchId}` | KDS active tickets | `order:new`, `order:status_updated` |
| `order:{orderId}` | Customer live order tracker | `order:status_updated`, `delivery:location_updated` |
| `delivery:{deliveryId}` | Rider live GPS coordinates | `delivery:location_updated`, `delivery:status_updated` |
| `rider:{riderId}` | Rider private dispatch channel | `delivery:assigned` |

---

## 7. POSTGRESQL MULTI-TENANT DATABASE SCHEMA

Located at `server/prisma/schema.prisma`:
- **`Tenant`**: `id`, `name`, `slug`, `status`, `currency`, `timezone`, `country`
- **`TenantBranding`**: `primaryColor`, `secondaryColor`, `accentColor`, `surfaceColor`, `logo`, `buttonRadius`, `cardRadius`
- **`TenantSettings`**: `minimumOrder`, `deliveryFee`, `freeDeliveryThreshold`, `hotline`, `whatsapp`, `deliveryEnabled`
- **`User`**: `id`, `tenantId`, `name`, `email`, `password`, `role` (7 roles), `phone`, `isActive`
- **`RefreshToken`**: `id`, `userId`, `token`, `expiresAt`, `revokedAt`
- **`Category`**: `id`, `tenantId`, `name`, `slug`, `image`, `sortOrder`, `isActive`
- **`Product`**: `id`, `tenantId`, `categoryId`, `name`, `slug`, `basePrice`, `discountedPrice`, `image`, `isAvailable`
- **`ProductOptionGroup`**: `id`, `tenantId`, `productId`, `name`, `minSelect`, `maxSelect`, `isRequired`
- **`ProductOption`**: `id`, `groupId`, `name`, `priceModifier`
- **`Branch`**: `id`, `tenantId`, `name`, `city`, `address`, `phone`, `isOpen`, `deliveryFee`, `minimumOrder`
- **`Order`**: `id`, `tenantId`, `branchId`, `orderNumber`, `orderMode`, `paymentMethod`, `status`, `subtotal`, `deliveryFee`, `discount`, `total`
- **`OrderItem`**: `id`, `orderId`, `productId`, `productName`, `quantity`, `unitPrice`, `totalPrice`, `optionsJson`
- **`OrderStatusHistory`**: `id`, `orderId`, `oldStatus`, `newStatus`, `changedBy`, `timestamp`
- **`Rider`**: `id`, `tenantId`, `userId`, `vehicleType`, `vehicleNumber`, `status`, `isAvailable`
- **`Delivery`**: `id`, `tenantId`, `orderId`, `riderId`, `status`, `assignedAt`, `pickedUpAt`, `deliveredAt`
- **`RiderLocation`**: `id`, `riderId`, `latitude`, `longitude`, `heading`, `speed`, `timestamp`
- **`Voucher`**: `id`, `tenantId`, `code`, `discountType`, `discountValue`, `minimumOrder`, `maximumDiscount`
- **`Banner`**: `id`, `tenantId`, `title`, `desktopImage`, `buttonText`, `buttonUrl`

---

## 8. API ENDPOINTS REFERENCE (V1)

Base URL: `http://localhost:5000/api/v1`

### Tenants & Super Admin
- `GET /tenants` - List active tenants (public for brand switcher)
- `GET /tenants/:slug/public` - Storefront initialization data
- `POST /tenants` - 1-Click Onboarding Wizard (Super Admin)
- `PUT /tenants/:id/branding` - Visual Branding Editor (Admin)
- `PUT /tenants/:id/settings` - Business Settings & Feature Flags (Admin)
- `GET /analytics/superadmin` - Platform-wide cross-tenant stats

### Authentication
- `POST /auth/register` - Customer signup within active tenant
- `POST /auth/login` - Unified login for all 7 roles across all brands
- `GET /auth/me` - Profile & permissions of authenticated user

### Catalog & Options
- `GET /categories` - Categories for active tenant
- `GET /products` - Products for active tenant (filtered by search, category, stock)
- `GET /products/:id` - Product with option groups (Sizes, Crusts, Portions)
- `POST /products/:id/options` - Add option customizer group (Admin)
- `PUT /products/:id` - Update price/stock (Admin)

### Orders & Tracking
- `POST /orders` - Authoritative order placement (calculates total server-side)
- `GET /orders` - Tenant orders feed (filtered by status/branch)
- `GET /orders/:id` - Order details with status history snapshot
- `PATCH /orders/:id/status` - Advance order workflow status (`PENDING` ➔ `PREPARING` ➔ `READY` ➔ `DELIVERED`)

### Riders & Deliveries
- `GET /deliveries/riders` - List active riders (Admin)
- `POST /deliveries/assign` - Assign rider to order
- `GET /deliveries/assigned` - Rider's active deliveries
- `PATCH /deliveries/:id/status` - Rider marks `PICKED_UP`, `ON_THE_WAY`, `DELIVERED`
- `POST /deliveries/:id/location` - Stream live rider GPS coordinates to customer map

---

## 9. HOW TO LAUNCH LOCALLY (NO DOCKER)

### Requirements:
- **Node.js** v18+ (tested on Node v24.14.0)
- **PostgreSQL** installed and running on `localhost:5432`

---

### Step 1 — Setup Database
Ensure PostgreSQL is running locally, then in `server/.env`:
```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/cheezious_db?schema=public"
PORT=5000
```

Run schema generation and seed:
```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

---

### Step 2 — Start Backend & Frontend
Using `start.sh`:
```bash
./start.sh
```

Or manually:
```bash
# Terminal 1 (Backend)
cd server
npm run dev

# Terminal 2 (Frontend)
cd client
npm run dev
```

---

## 10. END-TO-END VERIFICATION WALKTHROUGH

1. **Open Storefront:** Navigate to `http://localhost:5173/`.
2. **Switch Brands:** At the top banner, click **🍗 Savour Foods**. Notice the entire UI changes to Emerald Green & Royal Gold, displaying Traditional Pulao & Chicken Roasts.
3. **Switch Back:** Click **🍕 Cheezious**. The UI returns to Red & Yellow with Pizzas and Burgers.
4. **Try Customizer:** Click any Pizza or Pulao. The generic `<CustomizationModal>` opens allowing size and option selections with live price calculation.
5. **Place Order:** Add item to cart and proceed to Checkout. Order is placed with authoritative server-side pricing.
6. **Live Kitchen:** In a new window, log in as `kitchen@cheezious.com` (`Kitchen@123`). The kitchen display sounds an audio alert and displays the new ticket!
7. **Rider Dispatch:** Accept order, move to Ready. In Rider Dashboard (`rider@cheezious.com`), accept delivery and click "Broadcast Live GPS" to stream coordinates to the customer map.

---

## 11. CHANGELOG
- **v4.0.0 (Current):** Master White-Label Multi-Tenant SaaS platform transformation per PRD v1.0.0. Added dynamic branding engine, tenant isolation, option customizer, KDS display, live GPS broadcaster, Super Admin onboarding wizard, and pre-seeded Cheezious & Savour Foods.
- **v3.0.0:** Single login page for all 4 roles, removal of Docker containers.
- **v2.0.0:** Real-time WebSockets synchronization.
- **v1.0.0:** Initial Cheezious catalog scraper and layout.

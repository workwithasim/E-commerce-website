# 🍕 CHEEZIOUS 110% DYNAMIC FULL-STACK PERN PLATFORM

> **Platform:** Full-Stack Enterprise Food Delivery Platform  
> **Reference Website:** [https://cheezious.com/](https://cheezious.com/)  
> **Brand Slogan:** *"The Cheeziest Food in Town"*  
> **Tech Stack:** **PostgreSQL + Express.js + React.js + Node.js + TypeScript + WebSockets (Socket.io) + Docker**  
> **Version:** 2.0.0 (Production-Grade Commercial Architecture)  

---

## 📑 TABLE OF CONTENTS
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [A-to-Z Dynamic Features](#2-a-to-z-dynamic-features)
3. [Live Admin & Kitchen Portal](#3-live-admin--kitchen-portal)
4. [Real-time WebSockets Engine](#4-real-time-websockets-engine)
5. [PostgreSQL Database & Prisma Schema](#5-postgresql-database--prisma-schema)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Project Directory & File Structure](#7-project-directory--file-structure)
8. [How to Launch (One-Click Start)](#8-how-to-launch-one-click-start)
9. [Testing the Live Flow Step-by-Step](#9-testing-the-live-flow-step-by-step)
10. [Customization & Production Deployment](#10-customization--production-deployment)

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

This platform is a **110% dynamic, production-grade Full-Stack PERN system** modeled after Cheezious Pakistan. Unlike static clones, this system includes:
- **A Real Database:** PostgreSQL 16 (running via Docker) with Prisma ORM.
- **A Real Backend:** Node.js (v24) + Express + TypeScript with bi-directional WebSockets (`Socket.io`).
- **A Dynamic Customer Storefront:** React + TypeScript + Vite with dynamic category/product loading, customization, cart, vouchers, and live order tracking.
- **A Live Kitchen & Admin Portal:** Real-time incoming order sound/beeps, status progression (`PENDING` ➔ `PREPARING` ➔ `ON_THE_WAY` ➔ `DELIVERED`), dynamic product addition, price editing, and sales analytics.

```
                  ┌───────────────────────────────────────────────┐
                  │             PostgreSQL Database               │
                  │   Users, Products, Categories, Orders, etc.   │
                  └───────────────────────▲───────────────────────┘
                                          │ (Prisma ORM)
                  ┌───────────────────────┴───────────────────────┐
                  │      Node.js Express + TypeScript Server      │
                  │  - /api/products (110% Dynamic CRUD)          │
                  │  - /api/orders (Create, Status Updates)       │
                  │  - /api/categories, /api/branches             │
                  │  - Socket.io Server (Real-Time Bidirectional) │
                  └──────────────▲─────────────────▲──────────────┘
                                 │                 │
                (REST + WebSockets)               (REST + WebSockets)
                                 │                 │
     ┌───────────────────────────┴───┐         ┌───┴───────────────────────────┐
     │      Customer Storefront      │         │     Admin & Kitchen Portal    │
     │      (React + TypeScript)     │         │      (React + TypeScript)     │
     │ - Dynamic Menu & Search       │         │ - Live Orders Feed & Sound    │
     │ - Customization Modal         │         │ - Order Status Changer        │
     │ - Persistent Cart & Vouchers  │         │ - Dynamic "Add Product" Modal │
     │ - Real-Time Order Tracker     │         │ - Analytics (Sales, Revenue)  │
     └───────────────────────────────┘         └───────────────────────────────┘
```

---

## 2. A-TO-Z DYNAMIC FEATURES

| Feature | Description |
|---|---|
| **110% Dynamic Catalog** | Products, prices, descriptions, images, and stock availability are pulled directly from PostgreSQL. If an admin edits a price or adds a new pizza, all customer screens update immediately. |
| **Authentic Menu Pre-loaded** | The database is seeded with **127 authentic Cheezious products**, **36 categories**, and **61 nationwide branches** with high-resolution AWS S3 photography. |
| **Product Customizer** | Interactive modal for selecting sizes (Small, Regular, Large, Jumbo), crusts (Pan, Thin, Cheesy Stuffed, Crown Crust), flavors, beverages, and extra toppings with live price calculation. |
| **Persistent Shopping Cart** | Cart items and selections are saved in `localStorage`, surviving browser refreshes. |
| **Voucher Promo Engine** | Real backend validation for promo codes (`CHEEZY10` for 10% off, `WELCOME50` for Rs. 50 off, `SUPERCHEESE` for 15% off). |
| **Delivery vs Takeaway** | Dynamic fee calculator: Free delivery above Rs. 2,000 or for takeaway; Rs. 100 on smaller deliveries. |
| **Real-time Live Tracker** | Customer screen connects to WebSockets room. When the kitchen chef clicks "Start Baking", the customer's stepper moves to step 2 instantly with zero page reload. |

---

## 3. LIVE ADMIN & KITCHEN PORTAL

Click the **"⚡ Admin / Kitchen Feed"** button in the top right header to switch to the Kitchen & Admin Dashboard:
1. **Live Orders Queue (Kitchen Display System):**
   - Displays all active incoming customer orders in real time.
   - Emits an **audio beep notification** when a new order arrives.
   - Action buttons:
     - `👨‍🍳 Accept & Start Baking` (moves status to `PREPARING`)
     - `🛵 Rider Dispatched` (moves status to `ON_THE_WAY`)
     - `✓ Mark Delivered` (moves status to `DELIVERED`)
2. **Product Catalog Manager (CRUD):**
   - **"+ Add New Product" button**: Modal allowing admins to dynamically add any new pizza/burger/deal with Title, Category, Base Price, Image URL, and Description directly into PostgreSQL.
   - **In Stock / Out of Stock toggle**: Immediately takes items off the menu if ingredients run out.
   - **Delete Product button**: Removes discontinued products.
3. **Live Business Analytics:**
   - Today's Total Revenue in PKR.
   - Total Orders placed, active in kitchen, and delivered.

---

## 4. REAL-TIME WEBSOCKETS ENGINE

The backend uses **Socket.io** on top of the HTTP server. Key real-time events:

| Event Name | Direction | Payload | Purpose |
|---|---|---|---|
| `join:order` | Client ➔ Server | `orderId` | Customer joins private order tracking room |
| `join:kitchen` | Admin ➔ Server | `kitchen_room` | Admin/Kitchen staff joins live orders channel |
| `order:new` | Server ➔ Admin | `Order` object | Broadcasts new incoming customer order to kitchen |
| `order:status_updated` | Server ➔ Both | `Order` object | Updates status in real time on both customer stepper & admin list |
| `product:added` | Server ➔ All | `Product` object | Notifies all customer storefronts of newly added menu item |
| `product:updated` | Server ➔ All | `Product` object | Syncs price and stock changes |
| `product:deleted` | Server ➔ All | `productId` | Removes deleted item from customer screen |

---

## 5. POSTGRESQL DATABASE & PRISMA SCHEMA

Located at `server/prisma/schema.prisma`:
- **`Product`**: `id`, `name`, `description`, `price`, `discountedPrice`, `image`, `isBestSeller`, `isDeal`, `inStock`, `categoryId`, `createdAt`.
- **`Category`**: `id`, `name`, `image`, `slug`, `products`.
- **`Branch`**: `id`, `name`, `city`, `address`, `phone`, `isOpen`, `timing`.
- **`Order`**: `id`, `orderNumber` (`#CHZ-XXXX`), `customerName`, `customerPhone`, `deliveryAddress`, `landmark`, `notes`, `orderMode`, `paymentMethod`, `status`, `subtotal`, `deliveryFee`, `discount`, `total`, `items`.
- **`OrderItem`**: `id`, `orderId`, `productName`, `quantity`, `unitPrice`, `size`, `crust`, `flavor`, `drink`, `addons`, `instructions`.
- **`Voucher`**: `id`, `code`, `discountType`, `discountValue`, `minOrder`, `active`.

---

## 6. API ENDPOINTS REFERENCE

Base URL: `http://localhost:5000`

### Products & Categories
- `GET /api/products?search=bazinga&categoryId=...` - Get all products (with filters)
- `POST /api/products` - Create new product (Admin)
- `PUT /api/products/:id` - Edit product price/stock (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)
- `GET /api/categories` - Get all categories with product counts
- `POST /api/categories` - Create new category

### Branches
- `GET /api/branches?city=Islamabad` - Get branches by city
- `PATCH /api/branches/:id/toggle` - Toggle branch open/closed

### Orders & Tracking
- `POST /api/orders` - Place new order (Emits WebSocket `order:new`)
- `GET /api/orders?status=PREPARING` - Get orders for kitchen feed
- `GET /api/orders/:id` - Get order details by ID or `#CHZ-XXXX`
- `PATCH /api/orders/:id/status` - Update status (Emits WebSocket `order:status_updated`)

### Vouchers & Analytics
- `POST /api/vouchers/verify` - Check promo code validity & discount
- `GET /api/analytics/stats` - Live business metrics (Revenue, orders count)

---

## 7. PROJECT DIRECTORY & FILE STRUCTURE

```
chezzious website layout/
│
├── start.sh                    # One-click startup script (Docker + Backend + Frontend)
├── docker-compose.yml          # PostgreSQL 16 Alpine container configuration
├── readmeimportant.md          # Comprehensive documentation (this file)
│
├── server/                     # Node.js + Express + TypeScript + Prisma Backend
│   ├── .env                    # PostgreSQL connection string & PORT
│   ├── package.json            # Server dependencies (Express, Socket.io, Prisma, tsx)
│   ├── tsconfig.json           # Backend TypeScript configuration
│   ├── prisma/
│   │   ├── schema.prisma       # Relational database models (Orders, Products, Branches)
│   │   └── seed.ts             # Auto-seed script with 127 products & 61 branches
│   └── src/
│       └── index.ts            # Express REST API & Socket.io WebSockets server
│
├── client/                     # React 18 + TypeScript + Vite Frontend
│   ├── package.json            # Frontend dependencies (React, Socket.io-client, Vite)
│   ├── vite.config.ts          # Vite configuration on port 5173
│   ├── tsconfig.json           # Frontend TypeScript configuration
│   ├── index.html              # HTML entrypoint
│   └── src/
│       ├── types.ts            # TypeScript interfaces (Product, Order, CartItem, Branch)
│       ├── api.ts              # API service & Socket.io client connector
│       ├── styles.css          # Full Cheezious design system & responsive styling
│       ├── main.tsx            # React DOM mounting
│       ├── App.tsx             # Customer Storefront with live order tracker
│       └── admin/
│           └── AdminDashboard.tsx # Kitchen Display System, Live Orders & Product CRUD
│
├── data/                       # Scraped catalog assets (catalog.json, categories, products)
└── assets/                     # Official Cheezious vector SVG logo (cheezious.svg)
```

---

## 8. HOW TO LAUNCH (ONE-CLICK START)

### Single Command Launch:
Simply run:
```bash
./start.sh
```

This script will automatically:
1. Load Node.js v24.
2. Start the PostgreSQL 16 database in Docker on port `5432`.
3. Synchronize database schema via Prisma.
4. Launch the Express + Socket.io backend on **`http://localhost:5000`**.
5. Launch the React + TypeScript frontend on **`http://localhost:5173`**.

---

## 9. TESTING THE LIVE FLOW STEP-BY-STEP

To test the real-time interaction between customer and kitchen:

1. Open **`http://localhost:5173/`** in your browser.
2. Add a Pizza (e.g. *Crown Crust Pizza*) to your cart, customize crust and toppings.
3. Open the Cart Drawer, type coupon code **`CHEEZY10`** and click **Apply** (10% discount applied).
4. Click **Proceed to Checkout**, enter your name and phone, and click **Confirm & Place Order**.
5. You will see the **Live Order Tracker** screen showing `Order Placed`.
6. Now open another tab or click the header button **"⚡ Admin / Kitchen Feed"**:
   - You will see the new order in the kitchen feed with an alert banner!
7. Click **`👨‍🍳 Accept & Start Baking`**:
   - Return to the customer tab: Notice that the customer's stepper has **automatically moved to "Kitchen Preparing" in real-time via WebSockets**!
8. Click **`🛵 Rider Dispatched`** then **`✓ Mark Delivered`**:
   - Watch the customer's screen celebrate with the completed delivery status!

---

## 10. DOCKER DEPLOYMENT (PORTAINER / PRODUCTION)

The project is fully containerized and ready for **one-click deployment from GitHub via Portainer**.

### Stack Services (docker-compose.yml)

| Service | Image | Port | Role |
|---|---|---|---|
| `cheezious_postgres` | `postgres:16-alpine` | `5432` | PostgreSQL database |
| `cheezious_backend` | Built from `server/Dockerfile` | `5000` (internal) | Express + Prisma + Socket.io |
| `cheezious_frontend` | Built from `client/Dockerfile` | `80` → `8080` | React (Vite) + Nginx reverse proxy |

### Deploy via Portainer (GitHub)
1. Open Portainer → **Stacks → Add stack**
2. Select **Repository** build method
3. Repository URL: `https://github.com/workwithasim/E-commerce-website.git`
4. Branch: `refs/heads/main`
5. Compose path: `docker-compose.yml`
6. Enable **GitOps updates** (auto-redeploy on push)
7. Click **Deploy the stack**

### Access the Running App
- **Frontend:** `http://localhost` (port 80)
- **Backend API:** `http://localhost:5000/api`
- **Admin Portal:** Click `⚡ Admin Portal` in the sidebar

### Nginx Reverse Proxy
Nginx routes:
- `/` → React SPA (`dist/`)
- `/api/` → `http://backend:5000/api/`
- `/socket.io/` → `http://backend:5000/socket.io/` (WebSockets)

---

## 11. SIDEBAR (LEFT DRAWER) — Cheezious Exact Style

The left slide-out drawer (opened via the red ☰ hamburger button) matches the **official Cheezious.com sidebar**:

| Element | Description |
|---|---|
| **Yellow Avatar** | Circular yellow badge with person SVG icon |
| **Login to explore** | Sub-label when user is not logged in |
| **World of flavors** | Bold brand tagline |
| **LOGIN / LOGOUT button** | Bordered button; shows LOGOUT when user is authenticated |
| **Explore Menu** | Grid SVG icon + link to menu page |
| **Branch Locator** | House SVG icon + link to branches page |
| **Blog / Privacy Policy** | Plain text footer links |
| **Admin Portal** | Settings icon + link (blue accent color) |
| **Cheezious Hotline bar** | Yellow sticky footer with logo, text, and circular phone call button |

---

## 12. CHANGELOG

| Date | Version | Change |
|---|---|---|
| 2026-09-09 | 2.3.0 | Exact Cheezious sidebar: avatar, login, SVG nav icons, hotline bar |
| 2026-09-09 | 2.2.0 | Fixed Prisma OpenSSL detection (binaryTargets + libssl-dev) |
| 2026-09-09 | 2.1.0 | Docker Portainer GitHub deployment (GitOps auto-redeploy) |
| 2026-09-08 | 2.0.0 | Full PERN stack + Docker + 100% Cheezious UI parity |
| 2026-09-08 | 1.0.0 | Initial full-stack PERN implementation |

---

*Crafted with 100% production rigor, enterprise TypeScript architecture, and extra cheese!* 🍕🧀🔥

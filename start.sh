#!/usr/bin/env bash
# ==============================================================================
# WHITE-LABEL MULTI-TENANT RESTAURANT SAAS PLATFORM (No-Docker Local Launch)
# ==============================================================================

set -e

# 1. Resolve Node.js from NVM or environment
if [ -d "$HOME/.nvm/versions/node/v24.14.0/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
fi

echo "🚀 =================================================================="
echo "🚀  WHITE-LABEL MULTI-TENANT RESTAURANT PLATFORM (PERN + WebSockets)"
echo "🚀 =================================================================="
echo "Node: $(node -v) | npm: $(npm -v)"

# 2. Verify Database Connection
echo "📦 Checking PostgreSQL Database connection..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "🔄 Generating Prisma Client..."
npm run db:generate

# Start Backend Server
echo "🚀 Starting Express + TypeScript Multi-Tenant Backend on http://localhost:5000..."
npm run dev &
BACKEND_PID=$!
cd ..

# 3. Start Frontend Client
echo "🚀 Starting React + Vite White-Label Frontend on http://localhost:5173..."
cd client
if [ ! -d "node_modules" ]; then
  npm install
fi
npx vite --port 5173 --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 =================================================================="
echo "🎉  RESTAURANT PLATFORM IS LIVE & RUNNING!"
echo "🎉 =================================================================="
echo "👉 Customer Storefront:      http://localhost:5173/"
echo "👉 Unified Login Portal:     http://localhost:5173/ (1-Click Demo Login)"
echo "👉 Backend REST API:         http://localhost:5000/api/health"
echo "👉 Multi-Tenant API V1:      http://localhost:5000/api/v1/tenants"
echo "=================================================================="
echo "Available Demo Roles:"
echo "👑 Super Admin:   superadmin@platform.com  | SuperAdmin@123"
echo "🍕 Cheezious:     admin@cheezious.com      | Admin@123"
echo "🍗 Savour Foods:  admin@savour.com         | Admin@123"
echo "=================================================================="
echo "Press Ctrl+C to stop all servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" SIGINT SIGTERM
wait

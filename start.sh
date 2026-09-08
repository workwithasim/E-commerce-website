#!/usr/bin/env bash
# ==============================================================================
# CHEEZIOUS 110% DYNAMIC FULL-STACK PERN PLATFORM LAUNCH SCRIPT
# ==============================================================================

set -e

# 1. Resolve Node.js v24 from NVM or environment
if [ -d "$HOME/.nvm/versions/node/v24.14.0/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
fi

echo "🍕 ======================================================="
echo "🍕  CHEEZIOUS FULL-STACK PERN PLATFORM (TypeScript + Postgres)"
echo "🍕 ======================================================="
echo "Using Node $(node -v) and npm $(npm -v)"

# 2. Check and start Docker PostgreSQL Database
echo "📦 Checking PostgreSQL Database..."
if ! docker ps | grep -q "cheezious_postgres"; then
  echo "🚀 Starting PostgreSQL container on port 5432..."
  docker compose up -d db
  sleep 3
else
  echo "✅ PostgreSQL is running on port 5432"
fi

# 3. Start Backend Server
echo "🚀 Starting Express + TypeScript Backend on http://localhost:5000..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
fi
npx prisma db push --skip-generate
npx tsx src/index.ts &
BACKEND_PID=$!
cd ..

# 4. Start Frontend Client
echo "🚀 Starting React + TypeScript Frontend on http://localhost:5173..."
cd client
if [ ! -d "node_modules" ]; then
  npm install
fi
npx vite --port 5173 --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 ======================================================="
echo "🎉  CHEEZIOUS IS LIVE & RUNNING!"
echo "🎉 ======================================================="
echo "👉 Customer Storefront:     http://localhost:5173/"
echo "👉 Admin & Kitchen Portal:   http://localhost:5173/ (Click '⚡ Admin / Kitchen Feed')"
echo "👉 Backend REST API:        http://localhost:5000/api/health"
echo "👉 PostgreSQL Database:     localhost:5432 (cheezious_db)"
echo "=========================================================="
echo "Press Ctrl+C to stop all servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" SIGINT SIGTERM
wait

#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [ -d "$HOME/.nvm/versions/node/v24.14.0/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node.js and npm before starting the application." >&2
  exit 1
fi
if [ ! -f server/.env ]; then
  echo "Configure server/.env from server/.env.example first. See readmeimportant.md." >&2
  exit 1
fi
backend_pid=''
frontend_pid=''
cleanup() {
  if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; fi
  if [ -n "$frontend_pid" ]; then kill "$frontend_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM
if [ ! -d server/node_modules ]; then npm --prefix server ci; fi
if [ ! -d client/node_modules ]; then npm --prefix client ci; fi
npm --prefix server run db:generate
npm --prefix server run dev &
backend_pid=$!
npm --prefix client run dev &
frontend_pid=$!
echo "Starting storefront at http://localhost:5173 and API at http://localhost:5000."
echo "Use the API health endpoint to confirm database connectivity. Ctrl+C stops the servers."
wait -n "$backend_pid" "$frontend_pid"

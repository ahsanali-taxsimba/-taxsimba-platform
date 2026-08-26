#!/usr/bin/env bash
# Boots the frozen Python backend and the Node backend side by side, each against its own
# disposable database, and replays the parity journeys against both.
#
# Requires: a throwaway Mongo (default mongodb://127.0.0.1:27017) and a Python virtualenv
# with the backend runtime installed. Never point this at production data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO="${TEST_MONGO_URL:-mongodb://127.0.0.1:27017}"
VENV="${PARITY_VENV:-$ROOT/.parity-venv}"
PY_PORT="${PY_PORT:-8001}"
NODE_PORT="${NODE_PORT:-8002}"
STAMP="$(date +%s)"
PY_DB="taxsimba_parity_py_$STAMP"
NODE_DB="taxsimba_parity_node_$STAMP"

# Test-only values. Real secrets never live in the repository.
export JWT_SECRET="parity-harness-jwt-secret"
export TOTP_FERNET_KEY="${TOTP_FERNET_KEY:-$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')}"
export TOTP_ISSUER="TaxSimba Parity"
export CORS_ORIGINS="http://localhost:3000"
export CORS_DEV_ORIGINS=""
export COOKIE_SECURE="false"
export COOKIE_SAMESITE="lax"
export TRUSTED_PROXY_CIDRS="127.0.0.1/32"
export API_RATE_LIMIT_PER_MINUTE="100000"
export STRIPE_SECRET_KEY="sk_test_parity"
export STRIPE_WEBHOOK_SECRET="whsec_parity"
export STORAGE_DRIVER="local"
export LOCAL_STORAGE_DIR="/tmp/taxsimba-parity-storage"
export MONGO_URL="$MONGO"

cleanup() {
  [[ -n "${PY_PID:-}" ]] && kill "$PY_PID" 2>/dev/null || true
  [[ -n "${NODE_PID:-}" ]] && kill "$NODE_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "python db=$PY_DB  node db=$NODE_DB"

for port in "$PY_PORT" "$NODE_PORT"; do
  if curl -fsS "http://127.0.0.1:$port/api/" >/dev/null 2>&1; then
    echo "port $port is already serving — stop it first" >&2
    exit 2
  fi
done

(cd "$ROOT/backend-node" && npm run build >/dev/null)

# `exec` so $! is the server itself and the trap can stop it.
(cd "$ROOT/backend" && DB_NAME="$PY_DB" exec "$VENV/bin/python" -m uvicorn server:app \
  --host 127.0.0.1 --port "$PY_PORT" --log-level warning >"$ROOT/parity/python.log" 2>&1) &
PY_PID=$!

(cd "$ROOT/backend-node" && DB_NAME="$NODE_DB" PORT="$NODE_PORT" exec node dist/index.js \
  >"$ROOT/parity/node.log" 2>&1) &
NODE_PID=$!

for url in "http://127.0.0.1:$PY_PORT/api/" "http://127.0.0.1:$NODE_PORT/api/"; do
  for _ in $(seq 1 60); do
    curl -fsS "$url" >/dev/null 2>&1 && break
    sleep 1
  done
done

node "$ROOT/parity/harness.mjs" "http://127.0.0.1:$PY_PORT" "http://127.0.0.1:$NODE_PORT" \
  "$ROOT/parity/PARITY_REPORT.md"
STATUS=$?

"$VENV/bin/python" - "$MONGO" "$PY_DB" "$NODE_DB" <<'PY'
import sys
from pymongo import MongoClient
client = MongoClient(sys.argv[1])
for name in sys.argv[2:]:
    client.drop_database(name)
PY

exit $STATUS

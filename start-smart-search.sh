#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  Smart Algo Search"
echo "  ─────────────────────────────"
echo ""

# ── Backend ──
BACKEND="$SCRIPT_DIR/backend"
cd "$BACKEND"

if [ ! -d ".venv" ]; then
  echo "  [setup] Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "  [setup] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "  [start] Backend API  →  http://localhost:8001"
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# ── Smart Search Frontend ──
FRONTEND="$SCRIPT_DIR/smart-search-frontend"
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
  echo "  [setup] Installing Node dependencies..."
  npm install --silent
fi

echo "  [start] Smart Search UI  →  http://localhost:5174"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✓  Smart search stack started"
echo "  Open http://localhost:5174 in your browser"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

trap "echo ''; echo '  Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait

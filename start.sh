#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  📈  Backtest Lab"
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

echo "  [start] Backend API  →  http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ──
FRONTEND="$SCRIPT_DIR/frontend"
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
  echo "  [setup] Installing Node dependencies..."
  npm install --silent
fi

echo "  [start] Frontend UI  →  http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✓  Both servers started"
echo "  Open http://localhost:5173 in your browser"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

trap "echo ''; echo '  Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait

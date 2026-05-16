#!/usr/bin/env bash
# =============================================================================
# run_tests.sh  —  Start Appium + run the SayIt test suite
#
# Usage:
#   bash run_tests.sh                  # run all tests (ios, default)
#   bash run_tests.sh smoke            # run smoke tests only
#   bash run_tests.sh regression       # run regression tests only
#   bash run_tests.sh api              # run API tests (no device needed)
#   bash run_tests.sh smoke android    # smoke tests on Android
#
# The script starts Appium in the background automatically and kills it
# when tests finish.
# =============================================================================
set -euo pipefail

MARKER="${1:-all}"       # smoke | regression | api | all
PLATFORM="${2:-ios}"     # ios | android

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ── Activate venv ─────────────────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
  fail "Python venv not found — run 'bash setup.sh' first"
fi
source .venv/bin/activate

# ── Check .env ────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  fail ".env not found — copy .env.example to .env and fill in your values"
fi
source .env 2>/dev/null || true

# ── For non-API tests, verify app path is set ────────────────────────────────
if [ "$MARKER" != "api" ]; then
  if [ -z "${IOS_APP_PATH:-}" ] && [ "$PLATFORM" = "ios" ]; then
    fail "IOS_APP_PATH is not set in .env\n  Hint: build in Xcode, then run:\n  bash find_app.sh"
  fi
  if [ -z "${ANDROID_APP_PATH:-}" ] && [ "$PLATFORM" = "android" ]; then
    fail "ANDROID_APP_PATH is not set in .env"
  fi
fi

# ── Start Appium server ───────────────────────────────────────────────────────
APPIUM_PORT="${APPIUM_PORT:-4723}"
APPIUM_LOG="reports/appium_server.log"
mkdir -p reports

echo -e "\n${YELLOW}Starting Appium server on port $APPIUM_PORT...${NC}"
appium --port "$APPIUM_PORT" --log "$APPIUM_LOG" --log-timestamp &
APPIUM_PID=$!
echo "  Appium PID: $APPIUM_PID"

# Wait for Appium to be ready
echo -n "  Waiting for Appium"
for i in {1..20}; do
  if curl -s "http://127.0.0.1:$APPIUM_PORT/status" | grep -q "ready"; then
    echo ""
    ok "Appium is ready"
    break
  fi
  echo -n "."
  sleep 1
done

# Trap to kill Appium when script exits
cleanup() {
  echo -e "\n${YELLOW}Stopping Appium (PID $APPIUM_PID)...${NC}"
  kill "$APPIUM_PID" 2>/dev/null || true
  ok "Appium stopped"
}
trap cleanup EXIT

# ── Build pytest command ──────────────────────────────────────────────────────
PYTEST_ARGS=("--platform=$PLATFORM")

if [ "$MARKER" = "all" ]; then
  echo -e "\n${YELLOW}Running ALL tests on $PLATFORM...${NC}\n"
elif [ "$MARKER" = "api" ]; then
  echo -e "\n${YELLOW}Running API tests (no device needed)...${NC}\n"
  PYTEST_ARGS+=("-m" "api")
else
  echo -e "\n${YELLOW}Running $MARKER tests on $PLATFORM...${NC}\n"
  PYTEST_ARGS+=("-m" "$MARKER")
fi

# Run tests
set +e   # don't exit on test failure — we want the cleanup to run
python -m pytest "${PYTEST_ARGS[@]}"
EXIT_CODE=$?
set -e

# ── Report ────────────────────────────────────────────────────────────────────
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  ok "All tests passed ✅"
else
  warn "Some tests failed ❌  — see reports/report.html for details"
fi

echo ""
echo "  Full report: $(pwd)/reports/report.html"
echo "  Appium log:  $(pwd)/reports/appium_server.log"
echo ""

exit $EXIT_CODE

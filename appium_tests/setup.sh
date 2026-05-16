#!/usr/bin/env bash
# =============================================================================
# setup.sh  —  One-time setup for the SayIt Appium test framework
# Run from inside the appium_tests/ directory:  bash setup.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}──────────────────────────────${NC}"; echo -e "${YELLOW}$1${NC}"; }

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
step "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  warn "Homebrew not found. Installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  ok "Homebrew is installed"
fi

# ── 2. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via Homebrew..."
  brew install node
else
  NODE_VER=$(node --version)
  ok "Node.js $NODE_VER is installed"
fi

# ── 3. Appium 2 ───────────────────────────────────────────────────────────────
step "Checking Appium 2..."
if ! command -v appium &>/dev/null; then
  warn "Appium not found. Installing globally..."
  npm install -g appium
else
  APPIUM_VER=$(appium --version)
  ok "Appium $APPIUM_VER is installed"
fi

# ── 4. Appium XCUITest driver (iOS) ───────────────────────────────────────────
step "Installing Appium XCUITest driver (iOS)..."
if appium driver list --installed 2>/dev/null | grep -q "xcuitest"; then
  ok "XCUITest driver already installed"
else
  appium driver install xcuitest
  ok "XCUITest driver installed"
fi

# ── 5. Appium UiAutomator2 driver (Android) ───────────────────────────────────
step "Installing Appium UiAutomator2 driver (Android)..."
if appium driver list --installed 2>/dev/null | grep -q "uiautomator2"; then
  ok "UiAutomator2 driver already installed"
else
  appium driver install uiautomator2
  ok "UiAutomator2 driver installed"
fi

# ── 6. Python venv + dependencies ─────────────────────────────────────────────
step "Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  ok "Created .venv"
else
  ok ".venv already exists"
fi

source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
ok "Python dependencies installed"

# ── 7. .env file ──────────────────────────────────────────────────────────────
step "Checking .env file..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  warn ".env created from .env.example — EDIT IT before running tests!"
  warn "  → Set TEST_PHONE, IOS_APP_PATH, and API_BASE_URL at minimum"
else
  ok ".env file already exists"
fi

# ── 8. Reports folder ─────────────────────────────────────────────────────────
mkdir -p reports
ok "reports/ folder ready"

# ── 9. Appium doctor ──────────────────────────────────────────────────────────
step "Running appium-doctor to check iOS dependencies..."
npm install -g @appium/doctor 2>/dev/null || true
appium-doctor --ios 2>/dev/null || warn "appium-doctor reported issues — review above"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit appium_tests/.env  (set TEST_PHONE and IOS_APP_PATH)"
echo "  2. Build the app in Xcode → Product → Build For → Testing"
echo "  3. Run:  bash run_tests.sh smoke"
echo ""

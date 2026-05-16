# SayIt — Appium Test Framework

Automated test suite for the SayIt iOS/Android app.  
Built with **Python 3 + pytest + Appium 2**, using the Page Object Model pattern.

---

## Test types

| Suite | Marker | What it tests | Device needed? |
|-------|--------|---------------|----------------|
| Smoke | `smoke` | App launch, login screen, home screen, nav tabs | ✅ Yes |
| Regression | `regression` | Auth flow, profile, circle, navigation | ✅ Yes |
| API | `api` | All backend HTTP endpoints (security, validation) | ❌ No |

---

## One-time setup

### Step 1 — Run the setup script

Open Terminal, navigate to the `appium_tests/` folder and run:

```bash
cd /path/to/sayit/appium_tests
bash setup.sh
```

This automatically:
- Installs Node.js (via Homebrew) if missing
- Installs Appium 2 globally
- Installs the **XCUITest** driver (iOS) and **UiAutomator2** driver (Android)
- Creates a Python virtual environment and installs all dependencies
- Creates your `.env` file from the template
- Runs `appium-doctor` to verify iOS dependencies

### Step 2 — Build the app in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Set the scheme target to **Any iOS Simulator Device**
3. Press **⌘B** to build

Then run this to auto-detect the built `.app` path:

```bash
bash find_app.sh
```

This finds the latest build in Xcode's DerivedData and updates your `.env` automatically.

### Step 3 — Configure .env

Edit `appium_tests/.env`:

```env
# Your real phone number (for OTP tests)
TEST_PHONE=+919876543210

# The SayIt API (production or staging)
API_BASE_URL=https://sayit-gamma.vercel.app

# Auto-filled by find_app.sh:
IOS_APP_PATH=/Users/you/Library/Developer/Xcode/DerivedData/.../App.app
```

> **Never commit `.env`** — it contains real phone numbers. It is already in `.gitignore`.

---

## Running tests

All commands are run from the `appium_tests/` folder.

### Run API tests (fastest — no device needed)

```bash
bash run_tests.sh api
```

### Run smoke tests on iOS Simulator

```bash
bash run_tests.sh smoke ios
```

### Run full regression suite on iOS Simulator

```bash
bash run_tests.sh regression ios
```

### Run everything

```bash
bash run_tests.sh all ios
```

### Run on Android (emulator must be running)

```bash
bash run_tests.sh smoke android
```

The script starts and stops the Appium server automatically.

---

## Viewing results

After every run, open the HTML report:

```bash
open reports/report.html
```

Screenshots of **failed tests** are saved automatically to `reports/FAIL_<test_name>.png`.

---

## OTP tests

Tests that verify the full OTP login flow need a real SMS code:

1. Run the test once — it will send an OTP to `TEST_PHONE`
2. Note the 6-digit code from your SMS
3. Set it in `.env`: `TEST_OTP=123456`
4. Run the test again within 10 minutes

```bash
TEST_OTP=123456 bash run_tests.sh regression ios
```

Tests that require `TEST_OTP` are automatically **skipped** if it's not set — the rest of the suite still runs.

---

## Folder structure

```
appium_tests/
├── .env.example        ← template — copy to .env
├── requirements.txt    ← Python dependencies
├── pytest.ini          ← pytest config and markers
├── conftest.py         ← shared fixtures (driver, webview, api)
├── setup.sh            ← one-time setup script
├── run_tests.sh        ← test runner (starts Appium automatically)
├── find_app.sh         ← finds the Xcode .app build path
│
├── config/
│   ├── ios.yaml        ← iOS Appium capabilities
│   └── android.yaml    ← Android Appium capabilities
│
├── pages/              ← Page Object Model
│   ├── base_page.py    ← shared helpers (find, tap, scroll, wait)
│   ├── login_page.py
│   ├── home_page.py
│   ├── profile_page.py
│   └── circle_page.py
│
├── utils/
│   ├── driver_factory.py   ← Appium driver builder + WebView switcher
│   └── api_client.py       ← HTTP client for API tests
│
├── tests/
│   ├── smoke/
│   │   ├── test_launch.py          ← app opens, login screen visible
│   │   └── test_home_smoke.py      ← home screen, nav tabs
│   ├── regression/
│   │   ├── test_auth_regression.py
│   │   ├── test_navigation_regression.py
│   │   ├── test_profile_regression.py
│   │   └── test_circle_regression.py
│   └── api/
│       ├── test_otp_api.py         ← OTP send/verify validation
│       ├── test_card_api.py        ← card endpoint security
│       └── test_circle_api.py     ← circle endpoint auth checks
│
└── reports/            ← auto-generated (gitignored)
    ├── report.html
    ├── appium_server.log
    └── FAIL_*.png      ← screenshots of failed tests
```

---

## Adding new tests

1. Create a file in `tests/smoke/`, `tests/regression/`, or `tests/api/`
2. Mark it with `@pytest.mark.smoke`, `@pytest.mark.regression`, or `@pytest.mark.api`
3. Use page objects from `pages/` for UI interactions
4. Use `api` fixture for HTTP calls

Example:

```python
import pytest
from pages.home_page import HomePage

@pytest.mark.smoke
def test_my_new_test(webview):
    page = HomePage(webview)
    assert page.is_loaded()
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `No WEBVIEW context found` | App hasn't fully loaded — increase `launchTimeout` in `config/ios.yaml` |
| `Could not find App.app` | Run `bash find_app.sh` or check Xcode built successfully |
| `Connection refused on port 4723` | Appium didn't start — check `reports/appium_server.log` |
| `SessionNotCreatedException` | Simulator not booted — open Xcode → Window → Devices and Simulators |
| OTP tests skipped | Set `TEST_OTP=<code>` in `.env` within 10 min of receiving SMS |

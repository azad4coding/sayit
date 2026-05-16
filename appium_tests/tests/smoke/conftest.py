"""
tests/smoke/conftest.py
Fixtures that apply to every test inside tests/smoke/.

home_screen_guard
─────────────────
Auto-skips any test in TestHomeSmoke (or any test that uses the `webview`
fixture) when the app is showing the login screen instead of the home page.

WHY THIS IS NEEDED
The launch smoke tests (test_launch.py) verify the login screen loads.
The home smoke tests (test_home_smoke.py) assume the user is already
authenticated.  Appium starts a fresh app session each run, so if the
device/simulator has no saved auth (fresh install, wiped simulator, etc.)
the app will land on the login screen and every home test will fail with
confusing selector errors.

HOW TO GET HOME TESTS RUNNING
  1. Log in manually on the simulator (once).
  2. Re-run: pytest tests/smoke/ -v --platform=ios
     The app will open straight to the home screen and the guard passes.

Alternatively, run the full regression suite (which includes auth tests):
  pytest -m "smoke or regression" -v --platform=ios
"""

import pytest
import logging
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

logger = logging.getLogger(__name__)

# The bottom nav is present on every authenticated non-fullscreen page
# (home, wishes, history, gifts, circle, profile).  Using this instead of
# a home-page-specific selector means navigation tests that start from a
# non-home tab (e.g. test_navigate_back_to_home starts from profile) are
# not incorrectly skipped.  The login page never renders nav.bottom-nav.
_HOME_GATE_SELECTOR = "nav.bottom-nav"
_HOME_GATE_TIMEOUT  = 30  # seconds — allow time for auth check spinner to resolve


@pytest.fixture(autouse=True)
def home_screen_guard(request, webview):
    """
    Before each test in this folder, verify the WebView is showing the
    home screen.  If not, skip the test with a helpful message.

    Tests in TestAppLaunch are excluded (they intentionally run on the
    login screen).
    """
    # Only guard tests that belong to the home-screen suite
    cls = request.node.cls
    if cls is None or cls.__name__ == "TestAppLaunch":
        yield
        return

    try:
        WebDriverWait(webview, _HOME_GATE_TIMEOUT).until(
            EC.presence_of_element_located(
                (AppiumBy.CSS_SELECTOR, _HOME_GATE_SELECTOR)
            )
        )
        logger.info("home_screen_guard: home page confirmed")
    except TimeoutException:
        pytest.skip(
            "User does not appear to be logged in (bottom nav not found). "
            "Log in on the simulator manually, then re-run smoke tests. "
            "Or run the full regression suite which handles auth first."
        )

    yield

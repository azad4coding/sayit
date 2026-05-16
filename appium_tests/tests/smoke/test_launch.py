"""
test_launch.py  — SMOKE
Verifies the app launches and lands on a valid screen.

The app can open in two states:
  • UNAUTHENTICATED → login screen (fresh install / wiped simulator)
  • AUTHENTICATED   → any app screen with bottom nav (home, wishes, etc.)

_detect_state() polls for either known screen for up to DETECT_TIMEOUT
seconds.  This avoids the race condition where checking for the auth
spinner returns True before React has even hydrated.

Tests that only make sense on the login screen (phone input, Sign Up link)
skip automatically when the user is already logged in.
"""

import time
import pytest
from appium.webdriver.common.appiumby import AppiumBy

from pages.login_page import LoginPage

# How long (seconds) to poll for a known screen before giving up.
# Capacitor auth check (preferences read + supabase.auth.getUser) can
# easily take 15–30 s on a fresh simulator boot.
DETECT_TIMEOUT = 45

# Selector for the login screen gate — the "Send OTP →" button.
_LOGIN_LOCATOR = (AppiumBy.XPATH, "//button[contains(text(),'Send OTP')]")

# Selector for any authenticated app screen — the bottom nav is present
# on home, wishes, history, circle, profile (all non-fullscreen pages).
# Using this (rather than h3.text-gray-800) means the test is valid even
# when the home smoke tests have already navigated to a different tab.
_AUTH_NAV_LOCATOR = (AppiumBy.CSS_SELECTOR, "nav.bottom-nav")


def _detect_state(webview, timeout: int = DETECT_TIMEOUT) -> str:
    """
    Poll every second for up to `timeout` seconds.
    Returns 'login', 'home' (authenticated), or 'unknown'.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        # Check authenticated nav first (faster — login button has a full XPath)
        if webview.find_elements(*_AUTH_NAV_LOCATOR):
            return "home"
        if webview.find_elements(*_LOGIN_LOCATOR):
            return "login"
        time.sleep(1)
    return "unknown"


@pytest.mark.smoke
class TestAppLaunch:

    def test_app_launches(self, webview):
        """App opens and renders the WebView without crashing."""
        assert webview is not None

    def test_initial_screen_visible(self, webview):
        """
        After launch the app shows either the login screen or an
        authenticated app screen.  Any other outcome means the app
        crashed, is stuck on a blank page, or the WebView failed.
        """
        state = _detect_state(webview)
        assert state in ("login", "home"), (
            f"App is on an unexpected screen after {DETECT_TIMEOUT}s "
            f"(state={state!r}). "
            "Expected the login screen ('Send OTP' button) or an "
            "authenticated screen (bottom nav).  "
            "Check for crashes or slow network in the simulator."
        )

    def test_phone_input_interactive(self, webview):
        """
        Phone input accepts text.  Skipped when already logged in.
        """
        login = LoginPage(webview)
        if not login.is_on_login_screen():
            pytest.skip("Already logged in — login screen not showing")
        login.enter_phone("9876543210")

    def test_sign_up_link_present(self, webview):
        """
        'Sign Up' tab link is visible.  Skipped when already logged in.
        """
        login = LoginPage(webview)
        if not login.is_on_login_screen():
            pytest.skip("Already logged in — login screen not showing")
        assert login.is_visible("xpath", login.SIGN_UP_LINK_XPATH), (
            "Sign Up link not found on login screen"
        )

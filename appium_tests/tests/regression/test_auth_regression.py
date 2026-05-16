"""
test_auth_regression.py  — REGRESSION
Full authentication flow tests.

IMPORTANT: OTP-based login requires a real phone number (TEST_PHONE in .env)
and a human to read the SMS the first time. For CI pipelines, use a test
Twilio number with a fixed OTP, or mock the OTP endpoint.
"""

import os
import time
import pytest
from pages.login_page import LoginPage
from pages.home_page import HomePage


@pytest.mark.regression
class TestAuthRegression:

    def test_invalid_phone_shows_error(self, webview):
        """Entering fewer than 6 digits and tapping Send OTP shows an error."""
        page = LoginPage(webview)
        page.enter_phone("123")
        page.tap_send_otp()
        time.sleep(1)
        assert page.is_visible("css selector", page.ERROR_BOX), (
            "Error message not shown for invalid phone number"
        )

    def test_otp_screen_appears_after_valid_phone(self, webview, test_phone):
        """
        Entering a valid phone and tapping Send OTP transitions to the OTP screen.
        Uses TEST_PHONE from .env.
        """
        page = LoginPage(webview)
        # Strip country code — the page prepends +91 by default
        digits = test_phone.lstrip("+").lstrip("91")
        page.enter_phone(digits)
        page.tap_send_otp()
        time.sleep(2)
        assert page.is_on_otp_screen(), "OTP input boxes not visible after sending OTP"

    @pytest.mark.skipif(
        not os.getenv("TEST_OTP"),
        reason="Set TEST_OTP=<code> in .env to run end-to-end OTP verification",
    )
    def test_valid_otp_logs_in(self, webview, test_phone):
        """
        Full login: phone → OTP → home screen.
        Requires TEST_OTP env var (manually set the code from SMS).
        """
        otp_code = os.environ["TEST_OTP"]
        page = LoginPage(webview)
        digits = test_phone.lstrip("+").lstrip("91")
        page.login_with_otp(digits, otp_code)

        home = HomePage(webview)
        assert home.is_loaded(timeout=25), "Home screen did not appear after login"

    @pytest.mark.skipif(
        not os.getenv("TEST_OTP"),
        reason="Requires prior login via TEST_OTP",
    )
    def test_invalid_otp_shows_error(self, webview, test_phone):
        """Entering a wrong OTP code shows an error message."""
        page = LoginPage(webview)
        # Only try if we're on the OTP screen already
        if not page.is_on_otp_screen():
            digits = test_phone.lstrip("+").lstrip("91")
            page.enter_phone(digits)
            page.tap_send_otp()
            time.sleep(2)

        page.enter_otp("000000")
        page.tap_verify()
        time.sleep(2)
        assert page.is_visible("css selector", page.ERROR_BOX), (
            "Error not shown for wrong OTP"
        )

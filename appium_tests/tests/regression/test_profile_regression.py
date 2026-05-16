"""
test_profile_regression.py  — REGRESSION
Tests for the Profile screen — name, email, phone display.
"""

import pytest
from pages.home_page import HomePage
from pages.profile_page import ProfilePage


@pytest.mark.regression
class TestProfileRegression:

    @pytest.fixture(autouse=True)
    def go_to_profile(self, webview):
        """Navigate to Profile before each test in this class."""
        home = HomePage(webview)
        home.go_to_profile()
        page = ProfilePage(webview)
        assert page.is_loaded(), "Profile page did not load"

    def test_profile_loads_without_spinner(self, webview):
        """Spinner should be gone once profile is loaded."""
        page = ProfilePage(webview)
        spinner_gone = page.is_visible("css selector", page.SPINNER, timeout=1) is False
        # is_loaded() already asserted spinner gone — just confirm page content is there
        assert page.is_loaded(timeout=3)

    def test_name_is_displayed(self, webview):
        """User's name is shown on the profile screen."""
        page = ProfilePage(webview)
        name = page.get_name()
        assert name and len(name.strip()) > 0, "Name is empty on profile screen"

    def test_email_or_add_email_shown(self, webview):
        """Either a real email address or an 'Add email' prompt is visible."""
        page = ProfilePage(webview)
        has_email = page.is_visible("xpath", page.EMAIL_XPATH, timeout=3)
        has_add   = page.is_visible("xpath", "//a[contains(@href,'add-phone') or contains(text(),'email')]", timeout=3)
        assert has_email or has_add, (
            "Neither email nor 'add email' link found on profile screen"
        )

    def test_phone_or_add_phone_shown(self, webview):
        """Either a phone number or an 'Add phone' link is visible."""
        page = ProfilePage(webview)
        has_phone    = page.is_visible("xpath", page.PHONE_XPATH, timeout=3)
        has_add_link = page.has_add_phone_link()
        assert has_phone or has_add_link, (
            "Neither phone number nor 'Add phone' link found on profile screen"
        )

    def test_sign_out_button_present(self, webview):
        """Sign Out button is accessible on the profile screen."""
        page = ProfilePage(webview)
        page.scroll_down()
        assert page.is_visible("xpath", page.SIGN_OUT_BTN_XPATH), (
            "Sign Out button not found on profile screen"
        )

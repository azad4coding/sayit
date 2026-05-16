"""
test_home_smoke.py  — SMOKE
Quick sanity checks on the home screen.
Assumes the user is already logged in (session fixture shares state).

NOTE: These tests depend on test_auth_regression.py running first
      (which logs the user in). Run the full suite with:
        pytest -m smoke
      Or mark ordering with pytest-ordering if running in isolation.
"""

import pytest
from pages.home_page import HomePage


@pytest.mark.smoke
class TestHomeSmoke:

    def test_home_screen_loads(self, webview):
        """Home screen renders within 20 seconds of login."""
        page = HomePage(webview)
        assert page.is_loaded(timeout=20), "Home screen did not load in time"

    def test_greeting_visible(self, webview):
        """Greeting text (Good morning/afternoon/evening) is visible."""
        page = HomePage(webview)
        greeting = page.get_greeting()
        assert any(w in greeting for w in ["morning", "afternoon", "evening"]), (
            f"Unexpected greeting: {greeting!r}"
        )

    def test_bottom_nav_visible(self, webview):
        """Bottom navigation bar with all 6 tabs is rendered."""
        page = HomePage(webview)
        assert page.is_bottom_nav_visible(), "Bottom navigation not found"

    def test_hero_categories_present(self, webview):
        """At least one hero category card is displayed."""
        page = HomePage(webview)
        count = page.hero_cards_count()
        assert count >= 1, f"Expected at least 1 hero card, found {count}"

    def test_navigate_to_profile(self, webview):
        """Tapping Profile tab navigates to the profile screen."""
        from pages.profile_page import ProfilePage
        home = HomePage(webview)
        home.go_to_profile()
        profile = ProfilePage(webview)
        assert profile.is_loaded(), "Profile screen did not load after tab tap"

    def test_navigate_back_to_home(self, webview):
        """Tapping Home tab returns to the home screen."""
        home = HomePage(webview)
        home.tap(
            "css selector",
            home.NAV_HOME,
        )
        assert home.is_loaded(), "Home screen did not reload after tapping Home tab"

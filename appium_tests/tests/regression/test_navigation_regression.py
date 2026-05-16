"""
test_navigation_regression.py  — REGRESSION
Verifies all bottom navigation tabs load their screens correctly.
Depends on user being logged in.
"""

import pytest
from pages.home_page import HomePage
from pages.profile_page import ProfilePage
from pages.circle_page import CirclePage
from appium.webdriver.common.appiumby import AppiumBy


@pytest.mark.regression
class TestNavigationRegression:

    def test_home_tab(self, webview):
        """Home tab shows the category grid."""
        page = HomePage(webview)
        page.tap(AppiumBy.CSS_SELECTOR, page.NAV_HOME)
        assert page.is_loaded(), "Home screen failed to load"

    def test_circle_tab(self, webview):
        """Circle tab loads My Circle screen."""
        home = HomePage(webview)
        home.go_to_circle()
        page = CirclePage(webview)
        assert page.is_loaded(), "Circle screen failed to load"

    def test_profile_tab(self, webview):
        """Profile tab loads the Profile screen."""
        home = HomePage(webview)
        home.go_to_profile()
        page = ProfilePage(webview)
        assert page.is_loaded(), "Profile screen failed to load"

    def test_history_tab(self, webview):
        """History/Chats tab loads."""
        home = HomePage(webview)
        home.go_to_history()
        # Chats page has its own header
        header_visible = home.is_visible(
            AppiumBy.XPATH,
            "//h1[contains(text(),'Chats')]",
            timeout=10,
        )
        assert header_visible, "Chats screen header not found"

    def test_wishes_tab(self, webview):
        """Wishes tab loads."""
        home = HomePage(webview)
        home.go_to_wishes()
        header_visible = home.is_visible(
            AppiumBy.XPATH,
            "//h1[contains(text(),'Wishes') or contains(text(),'wish')]",
            timeout=10,
        )
        assert header_visible, "Wishes screen header not found"

    def test_back_to_home_from_circle(self, webview):
        """Back arrow button in the Circle header navigates back to Home."""
        home = HomePage(webview)
        home.go_to_circle()
        circle = CirclePage(webview)
        assert circle.is_loaded(), "Circle screen did not load"

        # Tap the back-arrow button (first button with style + SVG child in header)
        circle.tap_back()
        assert home.is_loaded(timeout=10), "Did not return to Home after tapping back arrow"

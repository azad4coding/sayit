"""
test_circle_regression.py  — REGRESSION
Tests for the My Circle screen.
"""

import pytest
from pages.home_page import HomePage
from pages.circle_page import CirclePage
from appium.webdriver.common.appiumby import AppiumBy


@pytest.mark.regression
class TestCircleRegression:

    @pytest.fixture(autouse=True)
    def go_to_circle(self, webview):
        """Navigate to Circle before each test."""
        home = HomePage(webview)
        home.go_to_circle()
        page = CirclePage(webview)
        assert page.is_loaded(), "Circle page did not load"

    def test_circle_loads_without_spinner(self, webview):
        """Spinner disappears and circle content renders."""
        page = CirclePage(webview)
        assert page.is_loaded(timeout=3)

    def test_header_title_is_my_circle(self, webview):
        """Page header says 'My Circle'."""
        page = CirclePage(webview)
        assert page.is_visible(
            AppiumBy.XPATH,
            "//h1[contains(text(),'My Circle')]",
        ), "My Circle header not found"

    def test_empty_state_or_members_visible(self, webview):
        """Either the empty state or at least one member row is shown."""
        page = CirclePage(webview)
        is_empty  = page.is_empty()
        has_members = page.member_count() > 0
        assert is_empty or has_members, (
            "Neither empty state nor member rows found on Circle screen"
        )

    def test_empty_state_send_button_works(self, webview):
        """If circle is empty, 'Send a Card' button navigates to Home."""
        page = CirclePage(webview)
        if not page.is_empty():
            pytest.skip("Circle is not empty — skipping empty-state test")
        page.tap_send_card()
        home = HomePage(webview)
        assert home.is_loaded(timeout=10), "Did not navigate to Home after Send a Card"

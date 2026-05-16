"""
circle_page.py
Page object for the My Circle screen (src/app/(app)/circle/page.tsx).

NOTE: The circle page uses inline styles (not CSS classes) for most of its
member row elements.  CSS selectors cannot match inline-styled elements, so
member detection uses XPath targeting the unique text content of each row.
"""

import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class CirclePage(BasePage):

    # ── Selectors ─────────────────────────────────────────────────────────────

    # Positive load gate: the h1 "My Circle" is the first content element
    # rendered after the loading spinner resolves.
    HEADER_TITLE_XPATH  = "//h1[contains(text(),'My Circle')]"

    # Empty state: <p class="text-base font-bold text-gray-700 text-center">
    #   Your Circle is empty
    # </p>
    EMPTY_STATE         = "p.text-base.font-bold"

    # Member presence: each member row shows either "✓ On SayIt" or
    # "Not on SayIt yet" as a span with inline styles.  XPath is required
    # because the parent divs use inline styles instead of CSS classes.
    MEMBER_SPAN_XPATH   = "//span[contains(text(),'On SayIt') or contains(text(),'Not on SayIt')]"

    # Back arrow button in the gradient header.
    # DOM layout: div[flex row] > button[back] + div[flex:1] > h1[My Circle]
    # Locate relative to the h1 to avoid SVG-namespace XPath issues:
    # h1 parent is div[flex:1], and the button is its preceding sibling.
    BACK_BTN_XPATH      = "//h1[contains(text(),'My Circle')]/../preceding-sibling::button"

    # "Send a Card" button in empty state
    SEND_CARD_BTN_XPATH = "//button[contains(text(),'Send a Card')]"

    SPINNER             = ".animate-spin"
    NEW_BADGE_XPATH     = "//*[contains(text(),'New')]"
    BLOCK_BTN           = "button[title='Block this contact']"
    BLOCK_CONFIRM_XPATH = "//button[contains(text(),'Block')]"
    CANCEL_BLOCK_XPATH  = "//button[contains(text(),'Cancel')]"

    # ── State ─────────────────────────────────────────────────────────────────

    def is_loaded(self, timeout: int = 15) -> bool:
        """
        Returns True once the 'My Circle' h1 is visible.
        Positive check avoids the race condition in wait_until_gone(.animate-spin).
        """
        return self.is_visible(AppiumBy.XPATH, self.HEADER_TITLE_XPATH, timeout=timeout)

    def is_empty(self) -> bool:
        """True if the empty-state paragraph is displayed."""
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.EMPTY_STATE, timeout=5)

    def member_count(self) -> int:
        """
        Count member rows by counting the unique SayIt-status spans.
        Each member row renders exactly one 'On SayIt' or 'Not on SayIt' span.
        """
        spans = self.find_all(AppiumBy.XPATH, self.MEMBER_SPAN_XPATH)
        return len(spans)

    def tap_back(self) -> None:
        """Tap the back-arrow button in the gradient header."""
        self.tap(AppiumBy.XPATH, self.BACK_BTN_XPATH)
        logger.info("Tapped Circle back button")

    def has_new_senders(self) -> bool:
        return self.is_visible(AppiumBy.XPATH, self.NEW_BADGE_XPATH, timeout=3)

    def tap_send_card(self) -> None:
        self.tap(AppiumBy.XPATH, self.SEND_CARD_BTN_XPATH)

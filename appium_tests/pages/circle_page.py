"""
circle_page.py
Page object for the My Circle screen (src/app/(app)/circle/page.tsx).
"""

import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class CirclePage(BasePage):

    HEADER_TITLE      = "h1"                        # "My Circle"
    MEMBER_ROWS       = "div.flex.items-center.gap-12"   # each contact row
    EMPTY_STATE       = "p.text-base.font-bold"     # "Your Circle is empty"
    SEND_CARD_BTN_XPATH = "//button[contains(text(),'Send a Card')]"
    SPINNER           = ".animate-spin"
    NEW_BADGE_XPATH   = "//*[contains(text(),'New')]"
    BLOCK_BTN         = "button[title='Block this contact']"
    BLOCK_CONFIRM_XPATH = "//button[contains(text(),'Block')]"
    CANCEL_BLOCK_XPATH  = "//button[contains(text(),'Cancel')]"
    PEOPLE_COUNT_XPATH  = "//p[contains(@style,'rgba(255,255,255,0.75)') and contains(text(),'connected')]"

    def is_loaded(self, timeout: int = 15) -> bool:
        try:
            self.wait_until_gone(AppiumBy.CSS_SELECTOR, self.SPINNER, timeout=timeout)
            return True
        except Exception:
            return self.is_visible(AppiumBy.XPATH, "//h1[contains(text(),'My Circle')]", timeout=5)

    def is_empty(self) -> bool:
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.EMPTY_STATE, timeout=5)

    def member_count(self) -> int:
        rows = self.find_all(AppiumBy.CSS_SELECTOR, self.MEMBER_ROWS)
        return len(rows)

    def has_new_senders(self) -> bool:
        return self.is_visible(AppiumBy.XPATH, self.NEW_BADGE_XPATH, timeout=3)

    def tap_send_card(self) -> None:
        self.tap(AppiumBy.XPATH, self.SEND_CARD_BTN_XPATH)

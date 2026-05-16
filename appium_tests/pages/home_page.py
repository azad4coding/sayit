"""
home_page.py
Page object for the SayIt home screen (src/app/(app)/home/page.tsx).
"""

import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class HomePage(BasePage):

    # ── Selectors (WebView context) ───────────────────────────────────────────
    # Home page: <header><p class="text-xs text-gray-400 font-medium">Good morning 👋</p></header>
    # Login page also has a p.text-gray-400 ("Welcome back") — scope to header to avoid
    # matching it when the app is on the login screen.
    GREETING_TEXT      = "header p.text-gray-400"     # "Good morning/afternoon/evening 👋"
    USER_NAME          = "header h2.text-gray-800"     # First name, scoped to header
    # Section title is unique to the home page — used as the is_loaded() gate
    SECTION_TITLE      = "h3.text-gray-800"            # "What would you like to send?"
    # Hero cards: <a href="/category/..."><div class="rounded-3xl ... h-[140px]">
    # Use shadow-md + rounded-3xl to target only the real cards (not skeletons which have
    # animate-pulse but no shadow-md).
    HERO_CARD          = "a > div.rounded-3xl.shadow-md"
    AI_CARD_BANNER     = "a[href='/create']"
    BOTTOM_NAV         = "nav.bottom-nav"
    NAV_HOME           = "a[href='/home']"
    NAV_WISHES         = "a[href='/wishes']"
    NAV_HISTORY        = "a[href='/history']"
    NAV_CIRCLE         = "a[href='/circle']"
    NAV_PROFILE        = "a[href='/profile']"
    SPINNER            = ".animate-spin"

    # Skeleton placeholders shown while categories load
    SKELETON           = ".animate-pulse"

    # ── Assertions ────────────────────────────────────────────────────────────

    def is_loaded(self, timeout: int = 20) -> bool:
        """
        Returns True once the home page section title is visible.

        Previously used wait_until_gone(.animate-pulse) which accidentally
        passed on the login screen (no skeletons there). Now we positively
        assert the section title which only appears on the home page.
        """
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.SECTION_TITLE, timeout=timeout)

    def get_greeting(self) -> str:
        return self.get_text(AppiumBy.CSS_SELECTOR, self.GREETING_TEXT)

    def get_user_first_name(self) -> str:
        return self.get_text(AppiumBy.CSS_SELECTOR, self.USER_NAME)

    def is_bottom_nav_visible(self) -> bool:
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.BOTTOM_NAV)

    def hero_cards_count(self) -> int:
        return len(self.find_all(AppiumBy.CSS_SELECTOR, self.HERO_CARD))

    # ── Navigation ────────────────────────────────────────────────────────────

    def go_to_wishes(self) -> None:
        self.tap(AppiumBy.CSS_SELECTOR, self.NAV_WISHES)

    def go_to_history(self) -> None:
        self.tap(AppiumBy.CSS_SELECTOR, self.NAV_HISTORY)

    def go_to_circle(self) -> None:
        self.tap(AppiumBy.CSS_SELECTOR, self.NAV_CIRCLE)

    def go_to_profile(self) -> None:
        self.tap(AppiumBy.CSS_SELECTOR, self.NAV_PROFILE)

    def tap_ai_card_banner(self) -> None:
        self.tap(AppiumBy.CSS_SELECTOR, self.AI_CARD_BANNER)
        logger.info("Tapped AI Card Creator banner")

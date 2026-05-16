"""
profile_page.py
Page object for the Profile screen (src/app/(app)/profile/page.tsx).
"""

import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class ProfilePage(BasePage):

    # ── Selectors (WebView context) ───────────────────────────────────────────

    # Positive load gate: the Account section white card is always rendered
    # once the page has loaded.  Avoids the race condition where checking for
    # .animate-spin returns True before React has hydrated.
    ACCOUNT_CARD      = "div.bg-white.rounded-2xl"

    # Name: <span class="text-2xl font-bold text-white drop-shadow">{name}</span>
    # (inside a button.flex.items-center.gap-2 in the gradient hero)
    FULL_NAME         = "span.text-2xl.font-bold"

    # Email section — the "Email" label is always rendered inside the Account
    # card regardless of whether the user has an email address.
    # XPath: <p class="text-[10px] ... text-gray-400 ...">Email</p>
    EMAIL_XPATH       = "//p[contains(@class,'text-gray-400') and normalize-space(text())='Email']"

    # Phone: <p class="text-sm font-semibold text-gray-800 truncate">{displayPhone}</p>
    PHONE_XPATH       = "//*[contains(@class,'text-gray-800') and contains(text(),'+')]"

    ADD_PHONE_LINK    = "a[href='/add-phone']"

    # Sign Out button text is literally "Sign Out"
    SIGN_OUT_BTN_XPATH = "//button[contains(text(),'Sign Out') or contains(text(),'Sign out')]"

    AVATAR            = "img[alt], .rounded-full"
    SPINNER           = ".animate-spin"

    # ── State ─────────────────────────────────────────────────────────────────

    def is_loaded(self, timeout: int = 15) -> bool:
        """
        Returns True once the Account section card is visible.
        Uses a positive presence check to avoid the race condition where
        wait_until_gone(.animate-spin) passes before the spinner appears.
        """
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.ACCOUNT_CARD, timeout=timeout)

    def get_name(self) -> str:
        """Returns the user's display name from the gradient hero area."""
        return self.get_text(AppiumBy.CSS_SELECTOR, self.FULL_NAME)

    def get_email(self) -> str:
        return self.get_text(AppiumBy.XPATH, self.EMAIL_XPATH)

    def get_phone(self) -> str:
        return self.get_text(AppiumBy.XPATH, self.PHONE_XPATH)

    def has_add_phone_link(self) -> bool:
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.ADD_PHONE_LINK)

    def tap_sign_out(self) -> None:
        self.scroll_down()
        self.tap(AppiumBy.XPATH, self.SIGN_OUT_BTN_XPATH)
        logger.info("Tapped Sign Out")

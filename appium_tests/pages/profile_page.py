"""
profile_page.py
Page object for the Profile screen (src/app/(app)/profile/page.tsx).
"""

import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class ProfilePage(BasePage):

    HEADER_TITLE      = "h1"                              # "Profile"
    FULL_NAME         = "p.text-xl, h2.font-bold"
    EMAIL_TEXT        = "p:has-text('@')"                 # fallback: xpath
    EMAIL_XPATH       = "//*[contains(@class,'text-gray') and contains(text(),'@')]"
    PHONE_TEXT        = "p:has-text('+')"
    PHONE_XPATH       = "//*[contains(@class,'text-gray') and contains(text(),'+')]"
    ADD_PHONE_LINK    = "a[href='/add-phone']"
    EDIT_PROFILE_BTN  = "button:has-text('Edit')"
    SIGN_OUT_BTN_XPATH = "//button[contains(text(),'Sign Out') or contains(text(),'Log Out') or contains(text(),'Sign out')]"
    AVATAR            = "img[alt='avatar'], .rounded-full"
    SPINNER           = ".animate-spin"

    def is_loaded(self, timeout: int = 15) -> bool:
        try:
            self.wait_until_gone(AppiumBy.CSS_SELECTOR, self.SPINNER, timeout=timeout)
            return True
        except Exception:
            return self.is_visible(AppiumBy.XPATH, "//h1[contains(text(),'Profile')]", timeout=5)

    def get_name(self) -> str:
        return self.get_text(AppiumBy.CSS_SELECTOR, self.FULL_NAME)

    def get_email(self) -> str:
        return self.get_text(AppiumBy.XPATH, self.EMAIL_XPATH)

    def get_phone(self) -> str:
        return self.get_text(AppiumBy.XPATH, self.PHONE_XPATH)

    def has_add_phone_link(self) -> bool:
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.ADD_PHONE_LINK)

    def tap_sign_out(self) -> None:
        self.tap(AppiumBy.XPATH, self.SIGN_OUT_BTN_XPATH)
        logger.info("Tapped Sign Out")

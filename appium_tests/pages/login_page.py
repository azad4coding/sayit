"""
login_page.py
Page object for the SayIt login / sign-in screen.
SayIt renders inside a Capacitor WebView, so all selectors are CSS/XPath
within the WebView context (switched to by the conftest fixture).
"""

import time
import logging
from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage

logger = logging.getLogger(__name__)


class LoginPage(BasePage):

    # ── CSS selectors (WebView context) ──────────────────────────────────────
    # These match the actual DOM elements in src/app/(auth)/login/page.tsx
    PHONE_INPUT       = "input[type='tel'][placeholder*='98765']"
    SEND_OTP_BTN      = "button:has-text('Send OTP')"   # fallback: xpath
    SEND_OTP_BTN_XPATH = "//button[contains(text(),'Send OTP')]"
    OTP_BOX_FIRST     = "input[type='tel'][maxlength='1']:first-of-type"
    OTP_BOXES         = "input[type='tel'][maxlength='1']"
    VERIFY_BTN_XPATH  = "//button[contains(text(),'Sign In')]"
    ERROR_BOX         = ".bg-red-50"
    COUNTRY_BTN       = "button.rounded-2xl"            # country code picker
    NAME_INPUT        = "input[placeholder='Your full name']"
    SAVE_NAME_BTN_XPATH = "//button[contains(text(),\"Let's go\")]"
    GOOGLE_BTN_XPATH  = "//button[contains(text(),'Continue with Google')]"
    SIGN_UP_LINK_XPATH = "//a[contains(text(),'Sign Up')]"

    # ── Actions ───────────────────────────────────────────────────────────────

    def enter_phone(self, phone_digits: str) -> None:
        """Type phone number (digits only, without country code)."""
        el = self.find(AppiumBy.CSS_SELECTOR, self.PHONE_INPUT)
        el.clear()
        el.send_keys(phone_digits)
        logger.info(f"Entered phone: {phone_digits}")

    def tap_send_otp(self) -> None:
        self.tap(AppiumBy.XPATH, self.SEND_OTP_BTN_XPATH)
        logger.info("Tapped Send OTP")

    def enter_otp(self, code: str) -> None:
        """Fill the 6 individual OTP boxes."""
        boxes = self.find_all(AppiumBy.CSS_SELECTOR, self.OTP_BOXES)
        assert len(boxes) == 6, f"Expected 6 OTP boxes, found {len(boxes)}"
        for i, digit in enumerate(code[:6]):
            boxes[i].click()
            boxes[i].send_keys(digit)
            time.sleep(0.1)
        logger.info("Entered OTP code")

    def tap_verify(self) -> None:
        self.tap(AppiumBy.XPATH, self.VERIFY_BTN_XPATH)
        logger.info("Tapped Verify / Sign In")

    def enter_name(self, name: str) -> None:
        el = self.find(AppiumBy.CSS_SELECTOR, self.NAME_INPUT)
        el.clear()
        el.send_keys(name)

    def tap_save_name(self) -> None:
        self.tap(AppiumBy.XPATH, self.SAVE_NAME_BTN_XPATH)

    def get_error_text(self) -> str:
        return self.get_text(AppiumBy.CSS_SELECTOR, self.ERROR_BOX)

    def is_on_login_screen(self) -> bool:
        # 10 s — gives the page time to finish rendering after the spinner resolves
        return self.is_visible(AppiumBy.XPATH, self.SEND_OTP_BTN_XPATH, timeout=10)

    def is_on_otp_screen(self) -> bool:
        return self.is_visible(AppiumBy.CSS_SELECTOR, self.OTP_BOXES, timeout=5)

    def login_with_otp(self, phone_digits: str, otp_code: str) -> None:
        """Full login flow: enter phone → send OTP → enter code → verify."""
        self.enter_phone(phone_digits)
        self.tap_send_otp()
        # Wait for OTP screen
        time.sleep(2)
        self.enter_otp(otp_code)
        self.tap_verify()

"""
base_page.py
All page objects inherit from BasePage.
Provides common wait, find, and tap helpers that work in both
NATIVE_APP and WebView (Capacitor hybrid) contexts.
"""

import time
import logging
from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 15


class BasePage:
    def __init__(self, driver: webdriver.Remote, timeout: int = DEFAULT_TIMEOUT):
        self.driver  = driver
        self.timeout = timeout
        self.wait    = WebDriverWait(driver, timeout)

    # ── Finders ──────────────────────────────────────────────────────────────

    def find(self, by: str, value: str, timeout: int | None = None):
        t = timeout or self.timeout
        try:
            return WebDriverWait(self.driver, t).until(
                EC.presence_of_element_located((by, value))
            )
        except TimeoutException:
            logger.error(f"Element not found: {by}={value!r} (timeout={t}s)")
            raise

    def find_all(self, by: str, value: str):
        return self.driver.find_elements(by, value)

    def find_by_accessibility_id(self, aid: str, timeout: int | None = None):
        return self.find(AppiumBy.ACCESSIBILITY_ID, aid, timeout)

    def find_by_xpath(self, xpath: str, timeout: int | None = None):
        return self.find(AppiumBy.XPATH, xpath, timeout)

    def find_by_class(self, cls: str, timeout: int | None = None):
        return self.find(AppiumBy.CLASS_NAME, cls, timeout)

    # WebView elements (CSS selector — works after switch_to_webview())
    def find_by_css(self, selector: str, timeout: int | None = None):
        return self.find(AppiumBy.CSS_SELECTOR, selector, timeout)

    # ── Actions ───────────────────────────────────────────────────────────────

    def tap(self, by: str, value: str, timeout: int | None = None):
        el = self.find(by, value, timeout)
        el.click()
        return el

    def type_text(self, by: str, value: str, text: str, clear_first: bool = True):
        el = self.find(by, value)
        if clear_first:
            el.clear()
        el.send_keys(text)
        return el

    def is_visible(self, by: str, value: str, timeout: int = 3) -> bool:
        try:
            self.find(by, value, timeout)
            return True
        except (TimeoutException, NoSuchElementException):
            return False

    def wait_until_gone(self, by: str, value: str, timeout: int | None = None):
        t = timeout or self.timeout
        WebDriverWait(self.driver, t).until(
            EC.invisibility_of_element_located((by, value))
        )

    def scroll_down(self, times: int = 1):
        size = self.driver.get_window_size()
        start_x = size["width"] // 2
        start_y = int(size["height"] * 0.75)
        end_y   = int(size["height"] * 0.25)
        for _ in range(times):
            self.driver.swipe(start_x, start_y, start_x, end_y, 800)
            time.sleep(0.3)

    def get_text(self, by: str, value: str) -> str:
        return self.find(by, value).text

    def take_screenshot(self, name: str):
        path = f"reports/{name}.png"
        self.driver.save_screenshot(path)
        logger.info(f"Screenshot saved: {path}")

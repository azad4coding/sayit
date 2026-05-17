"""
driver_factory.py
Builds an Appium WebDriver for iOS or Android from YAML config + env vars.
Also provides helpers to switch between NATIVE_APP and WebView contexts
(required for Capacitor hybrid apps).
"""

import os
import time
import yaml
import logging
from pathlib import Path
from appium import webdriver
from selenium.webdriver.common.options import ArgOptions
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent.parent / "config"


def _load_yaml(filename: str) -> dict:
    with open(CONFIG_DIR / filename) as f:
        return yaml.safe_load(f)


def build_driver(platform: str) -> webdriver.Remote:
    """
    Create and return an Appium driver for the given platform ("ios" or "android").
    Environment variables in .env override the YAML defaults.
    """
    platform = platform.lower()
    if platform not in ("ios", "android"):
        raise ValueError(f"Unknown platform: {platform!r}. Use 'ios' or 'android'.")

    caps = _load_yaml(f"{platform}.yaml")

    # ── Apply env-var overrides ───────────────────────────────────────────────
    if platform == "ios":
        if os.getenv("IOS_DEVICE_NAME"):
            caps["deviceName"] = os.environ["IOS_DEVICE_NAME"]
        if os.getenv("IOS_PLATFORM_VERSION"):
            caps["platformVersion"] = os.environ["IOS_PLATFORM_VERSION"]
        if os.getenv("IOS_BUNDLE_ID"):
            caps["bundleId"] = os.environ["IOS_BUNDLE_ID"]
        if os.getenv("IOS_APP_PATH"):
            caps["app"] = os.environ["IOS_APP_PATH"]
    else:
        if os.getenv("ANDROID_DEVICE_NAME"):
            caps["deviceName"] = os.environ["ANDROID_DEVICE_NAME"]
        if os.getenv("ANDROID_PLATFORM_VERSION"):
            caps["platformVersion"] = os.environ["ANDROID_PLATFORM_VERSION"]
        if os.getenv("ANDROID_APP_PACKAGE"):
            caps["appPackage"] = os.environ["ANDROID_APP_PACKAGE"]
        if os.getenv("ANDROID_APP_ACTIVITY"):
            caps["appActivity"] = os.environ["ANDROID_APP_ACTIVITY"]
        if os.getenv("ANDROID_APP_PATH"):
            caps["app"] = os.environ["ANDROID_APP_PATH"]

    host = os.getenv("APPIUM_HOST", "127.0.0.1")
    port = os.getenv("APPIUM_PORT", "4723")
    server_url = f"http://{host}:{port}"

    # Build options using Selenium's generic ArgOptions (works across all
    # Appium Python Client versions including 3.x on Python 3.13)
    options = ArgOptions()
    for key, value in caps.items():
        options.set_capability(key, value)

    logger.info(f"Starting {platform} driver → {server_url}")
    driver = webdriver.Remote(command_executor=server_url, options=options)
    logger.info(f"Session started: {driver.session_id}")
    return driver


# ── WebView context helpers ───────────────────────────────────────────────────

WEBVIEW_TIMEOUT = 15  # seconds to wait for WebView to appear


def dismiss_native_alerts(driver: webdriver.Remote) -> None:
    """
    Dismiss any pending native iOS alert (permission popups, system dialogs).
    Must be called while in NATIVE_APP context.
    Safe to call when no alert is present — exceptions are silently ignored.
    """
    try:
        alert = driver.switch_to.alert
        logger.info(f"Dismissing native alert: {alert.text!r}")
        alert.dismiss()
    except Exception:
        pass  # No alert present — that's fine


def switch_to_webview(driver: webdriver.Remote, platform: str = "ios") -> bool:
    """
    Switch into the Capacitor WebView context.
    Returns True on success, False if no WebView found within timeout.

    iOS:     dismisses native alert popups each loop iteration
             (notifications, contacts). autoDismissAlerts capability also
             handles these, but the explicit dismiss is a belt-and-suspenders
             fallback for alerts that appear after session start.

    Android: skips alert dismissal — autoGrantPermissions: true in
             android.yaml handles permissions at the OS level, and
             Android permission dialogs are not WebDriver alerts.
    """
    deadline = time.time() + WEBVIEW_TIMEOUT
    while time.time() < deadline:
        if platform == "ios":
            # Ensure we're in native context before attempting alert dismissal
            try:
                if driver.current_context != "NATIVE_APP":
                    driver.switch_to.context("NATIVE_APP")
            except Exception:
                pass
            dismiss_native_alerts(driver)

        contexts = driver.contexts
        webview = next(
            (c for c in contexts if c.startswith("WEBVIEW")),
            None,
        )
        if webview:
            driver.switch_to.context(webview)
            logger.info(f"Switched to context: {webview}")
            return True
        time.sleep(0.5)
    logger.warning("No WEBVIEW context found within timeout")
    return False


def switch_to_native(driver: webdriver.Remote) -> None:
    """Switch back to the native app context."""
    driver.switch_to.context("NATIVE_APP")
    logger.info("Switched to NATIVE_APP context")

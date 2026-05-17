"""
conftest.py
Pytest fixtures shared across all test modules.

Key fixtures:
  driver       — Appium WebDriver (session per test module by default)
  webview      — driver already switched into the Capacitor WebView
  api          — SayItApiClient instance (no auth)
  auth_api     — SayItApiClient with a token (requires TEST_PHONE in .env
                 and a real OTP — intended for pre-seeded integration envs)

Run with --platform=ios or --platform=android (default: ios)
"""

import os
import pytest
import logging
from dotenv import load_dotenv
from pathlib import Path

from utils.driver_factory import build_driver, switch_to_webview, switch_to_native
from utils.api_client import SayItApiClient

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger(__name__)


# ── CLI option ────────────────────────────────────────────────────────────────

def pytest_addoption(parser):
    parser.addoption(
        "--platform",
        action="store",
        default="ios",
        choices=["ios", "android"],
        help="Target platform: ios or android",
    )


@pytest.fixture(scope="session")
def platform(request) -> str:
    return request.config.getoption("--platform")


# ── Appium driver (session-scoped — one app launch per test run) ──────────────

@pytest.fixture(scope="session")
def driver(platform):
    """
    Launch the app once for the entire test session.
    Use `module` scope if you need a fresh app per test file.
    """
    d = build_driver(platform)
    yield d
    logger.info("Quitting Appium driver")
    d.quit()


@pytest.fixture(scope="session")
def webview(driver, platform):
    """
    Driver already switched into the Capacitor WebView.
    All CSS/XPath selectors in page objects target this context.
    Platform is passed so iOS-specific alert dismissal is skipped on Android.
    """
    ok = switch_to_webview(driver, platform=platform)
    assert ok, "Could not find WebView context — is the app loaded?"
    yield driver
    # Don't switch back — session teardown handles cleanup


@pytest.fixture(autouse=True)
def screenshot_on_failure(request):
    """Auto-capture screenshot when a UI test fails.
    Skipped automatically for API tests (no driver needed)."""
    yield
    # Only attempt screenshot if the test actually used the driver fixture
    if "driver" not in request.fixturenames:
        return
    failed = getattr(request.node, "rep_call", None)
    if failed and failed.failed:
        try:
            d = request.getfixturevalue("driver")
            name = request.node.name.replace("/", "_")
            d.save_screenshot(f"reports/FAIL_{name}.png")
            logger.warning(f"Screenshot saved: reports/FAIL_{name}.png")
        except Exception:
            pass  # never let screenshot failure break test reporting


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


# ── API client fixtures ───────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def api() -> SayItApiClient:
    """Unauthenticated API client."""
    return SayItApiClient()


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.getenv("API_BASE_URL", "https://sayit-gamma.vercel.app")


@pytest.fixture(scope="session")
def test_phone() -> str:
    phone = os.getenv("TEST_PHONE", "")
    assert phone, "Set TEST_PHONE in .env (e.g. +919876543210)"
    return phone


@pytest.fixture(scope="session")
def test_phone_2() -> str:
    phone = os.getenv("TEST_PHONE_2", "")
    assert phone, "Set TEST_PHONE_2 in .env for multi-user tests"
    return phone

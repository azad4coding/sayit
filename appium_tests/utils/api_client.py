"""
api_client.py
Thin wrapper around `requests` for hitting the SayIt Next.js API.
Used by API test suite and by UI tests that need to seed/teardown data.
"""

import os
import logging
import requests
from typing import Any
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")
logger = logging.getLogger(__name__)

BASE_URL = os.getenv("API_BASE_URL", "https://sayit-gamma.vercel.app")


class SayItApiClient:
    """
    Stateless HTTP client for the SayIt API.
    Pass `token` (Supabase access token) for authenticated endpoints.
    """

    def __init__(self, token: str | None = None, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")
        self._token = token
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def set_token(self, token: str) -> None:
        self._token = token

    def _auth_headers(self) -> dict:
        if self._token:
            return {"Authorization": f"Bearer {self._token}"}
        return {}

    def _log(self, method: str, path: str, status: int) -> None:
        logger.info(f"{method} {path} → {status}")

    # ── OTP ──────────────────────────────────────────────────────────────────

    def send_otp(self, phone: str) -> requests.Response:
        r = self.session.post(
            f"{self.base_url}/api/otp/send",
            json={"phone": phone},
        )
        self._log("POST", "/api/otp/send", r.status_code)
        return r

    def verify_otp(self, phone: str, code: str, token: str) -> requests.Response:
        r = self.session.post(
            f"{self.base_url}/api/otp/verify",
            json={"phone": phone, "code": code},
            headers={"Authorization": f"Bearer {token}"},
        )
        self._log("POST", "/api/otp/verify", r.status_code)
        return r

    # ── Cards ─────────────────────────────────────────────────────────────────

    def get_card(self, short_code: str) -> requests.Response:
        r = self.session.get(f"{self.base_url}/api/card/{short_code}")
        self._log("GET", f"/api/card/{short_code}", r.status_code)
        return r

    def clear_history(self, token: str) -> requests.Response:
        r = self.session.post(
            f"{self.base_url}/api/clear-history",
            headers={"Authorization": f"Bearer {token}"},
        )
        self._log("POST", "/api/clear-history", r.status_code)
        return r

    # ── Circle ────────────────────────────────────────────────────────────────

    def circle_status(self, token: str, phone: str) -> requests.Response:
        r = self.session.post(
            f"{self.base_url}/api/circle/status",
            json={"phone": phone},
            headers=self._auth_headers() or {"Authorization": f"Bearer {token}"},
        )
        self._log("POST", "/api/circle/status", r.status_code)
        return r

    def circle_action(self, token: str, action: str, phone: str) -> requests.Response:
        r = self.session.post(
            f"{self.base_url}/api/circle/action",
            json={"action": action, "phone": phone},
            headers={"Authorization": f"Bearer {token}"},
        )
        self._log("POST", "/api/circle/action", r.status_code)
        return r

    # ── Helpers ───────────────────────────────────────────────────────────────

    def assert_ok(self, response: requests.Response, expected_status: int = 200) -> Any:
        """Assert status and return parsed JSON."""
        assert response.status_code == expected_status, (
            f"Expected {expected_status}, got {response.status_code}.\n"
            f"Body: {response.text[:500]}"
        )
        return response.json()

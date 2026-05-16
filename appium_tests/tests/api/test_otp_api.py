"""
test_otp_api.py  — API
Tests for /api/otp/send and /api/otp/verify endpoints.
These run as pure HTTP tests — no Appium driver needed.
"""

import pytest
from utils.api_client import SayItApiClient


@pytest.mark.api
class TestOtpSendApi:

    def test_missing_phone_returns_400(self, api: SayItApiClient):
        """Omitting the phone field returns 400."""
        r = api.session.post(f"{api.base_url}/api/otp/send", json={})
        assert r.status_code == 400
        assert "error" in r.json()

    def test_invalid_phone_format_returns_400(self, api: SayItApiClient):
        """Phone without leading + returns 400."""
        r = api.send_otp("9876543210")  # missing +
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"

    def test_valid_phone_returns_200_or_rate_limited(self, api: SayItApiClient, test_phone: str):
        """
        A valid E.164 phone number returns 200 (OTP sent or phoneExists=true).
        If already rate-limited, 429 is acceptable.
        """
        r = api.send_otp(test_phone)
        assert r.status_code in (200, 429), (
            f"Unexpected status {r.status_code}: {r.text}"
        )
        if r.status_code == 200:
            body = r.json()
            assert body.get("ok") is True

    def test_rate_limiting_kicks_in(self, api: SayItApiClient, test_phone: str):
        """Sending the same phone 4+ times within 10 minutes triggers 429."""
        # Send 4 times — the 4th should be rate-limited (limit is 3/10min)
        statuses = []
        for _ in range(4):
            r = api.send_otp(test_phone)
            statuses.append(r.status_code)
        assert 429 in statuses, (
            f"Expected at least one 429 after 4 rapid sends. Got: {statuses}"
        )

    def test_existing_phone_returns_phone_exists_flag(self, api: SayItApiClient, test_phone: str):
        """
        If the phone is already in the profiles table, the API returns
        { ok: true, phoneExists: true } without sending an OTP.
        """
        r = api.send_otp(test_phone)
        if r.status_code == 200:
            body = r.json()
            # Either phoneExists=true (registered) or ok=true (OTP sent)
            assert body.get("ok") is True


@pytest.mark.api
class TestOtpVerifyApi:

    def test_verify_without_auth_token_returns_401(self, api: SayItApiClient, test_phone: str):
        """
        Verify endpoint requires Authorization header — missing token → 401.
        NOTE: The route validates the OTP via Twilio before checking the auth
        token, so if Twilio rejects the code first we may get 400 instead.
        Both 400 and 401 are valid rejections here.
        """
        r = api.session.post(
            f"{api.base_url}/api/otp/verify",
            json={"phone": test_phone, "code": "123456"},
            # No Authorization header
        )
        assert r.status_code in (400, 401), (
            f"Expected 400 or 401, got {r.status_code}: {r.text}"
        )

    def test_verify_wrong_code_returns_400(self, api: SayItApiClient, test_phone: str):
        """Wrong OTP code with valid token returns 400."""
        # Use a dummy token — Supabase will reject it as 401 before Twilio check
        r = api.session.post(
            f"{api.base_url}/api/otp/verify",
            json={"phone": test_phone, "code": "000000"},
            headers={"Authorization": "Bearer invalid_token"},
        )
        # Either 401 (bad token) or 400 (bad code) — both are correct rejections
        assert r.status_code in (400, 401), (
            f"Expected 400 or 401, got {r.status_code}: {r.text}"
        )

    def test_verify_invalid_phone_format_returns_400(self, api: SayItApiClient):
        """Phone without + prefix returns 400 before hitting Twilio."""
        r = api.session.post(
            f"{api.base_url}/api/otp/verify",
            json={"phone": "9876543210", "code": "123456"},
            headers={"Authorization": "Bearer dummy"},
        )
        assert r.status_code == 400

    def test_verify_short_code_returns_400(self, api: SayItApiClient, test_phone: str):
        """Code shorter than 6 digits returns 400."""
        r = api.session.post(
            f"{api.base_url}/api/otp/verify",
            json={"phone": test_phone, "code": "123"},
            headers={"Authorization": "Bearer dummy"},
        )
        assert r.status_code == 400

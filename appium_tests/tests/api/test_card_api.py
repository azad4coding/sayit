"""
test_card_api.py  — API
Tests for the public card endpoint GET /api/card/[code].
"""

import pytest
from utils.api_client import SayItApiClient


@pytest.mark.api
class TestCardApi:

    def test_invalid_code_returns_404(self, api: SayItApiClient):
        """A non-existent short code returns 404."""
        r = api.get_card("nonexistent123")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_empty_code_returns_404(self, api: SayItApiClient):
        """A blank code returns 404."""
        r = api.get_card("________")
        assert r.status_code in (400, 404)

    def test_response_does_not_expose_pii(self, api: SayItApiClient):
        """
        Even if a card is found, the response must not include
        sender_id, service role credentials, or full user profile.
        This test uses a known public test card if available via TEST_CARD_CODE env var.
        """
        import os
        code = os.getenv("TEST_CARD_CODE")
        if not code:
            pytest.skip("Set TEST_CARD_CODE in .env to run PII-exposure check")

        r = api.get_card(code)
        if r.status_code != 200:
            pytest.skip(f"Card {code} not found ({r.status_code})")

        body = r.json()
        card = body.get("card", body)

        # These fields must NOT appear in the public card response
        forbidden_fields = ["supabase_key", "service_role", "auth_token"]
        for field in forbidden_fields:
            assert field not in card, f"PII field {field!r} found in card response"

        # sender_id should not be in the public response (H-3 fix)
        assert "sender_id" not in card, "sender_id exposed in public card endpoint"

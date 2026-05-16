"""
test_circle_api.py  — API
Tests for circle/status, circle/action, circle/resolve endpoints.
All endpoints require a valid Bearer token.
"""

import pytest
from utils.api_client import SayItApiClient


@pytest.mark.api
class TestCircleApiSecurity:

    def test_status_without_token_returns_401(self, api: SayItApiClient, test_phone: str):
        """circle/status requires auth — no token → 401."""
        # Endpoint is GET with query params: ?senderid=...&phone=...
        r = api.session.get(
            f"{api.base_url}/api/circle/status",
            params={"senderid": "fake-sender-id", "phone": test_phone},
            # no Authorization header
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_action_without_token_returns_401(self, api: SayItApiClient, test_phone: str):
        """circle/action requires auth — no token → 401."""
        r = api.session.post(
            f"{api.base_url}/api/circle/action",
            json={"action": "accept", "phone": test_phone},
            # no Authorization header
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_status_with_invalid_token_returns_401(self, api: SayItApiClient, test_phone: str):
        """Invalid Bearer token → 401."""
        # Endpoint is GET with query params: ?senderid=...&phone=...
        r = api.session.get(
            f"{api.base_url}/api/circle/status",
            params={"senderid": "fake-sender-id", "phone": test_phone},
            headers={"Authorization": "Bearer totally_fake_token"},
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_action_with_invalid_token_returns_401(self, api: SayItApiClient, test_phone: str):
        """Invalid Bearer token on action endpoint → 401."""
        r = api.session.post(
            f"{api.base_url}/api/circle/action",
            json={"action": "block", "phone": test_phone},
            headers={"Authorization": "Bearer totally_fake_token"},
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


@pytest.mark.api
class TestGenerateAiCardSecurity:

    def test_generate_without_token_returns_401(self, api: SayItApiClient):
        """generate-ai-card requires auth — no token → 401."""
        import io
        # Send as multipart form (as the real endpoint expects)
        r = api.session.post(
            f"{api.base_url}/api/generate-ai-card",
            data={"prompt": "test", "userId": "fake-user-id"},
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

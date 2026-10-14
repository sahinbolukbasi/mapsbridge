from fastapi.testclient import TestClient

from adreskopru.interfaces.http.app import app

client = TestClient(app)
headers = {"x-dev-subject": "test-user"}


def test_user_cannot_read_another_users_addresses() -> None:
    create = client.post("/v1/addresses", headers=headers, json={"label": "Ev", "formatted_address": "Kadıköy, İstanbul", "latitude": 40.99, "longitude": 29.03})
    assert create.status_code == 201
    assert len(client.get("/v1/addresses", headers=headers).json()) == 1
    assert client.get("/v1/addresses", headers={"x-dev-subject": "other-user"}).json() == []


def test_missing_authentication_is_rejected() -> None:
    assert client.get("/v1/addresses").status_code == 401

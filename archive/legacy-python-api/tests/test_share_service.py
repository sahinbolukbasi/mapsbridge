from datetime import UTC, datetime, timedelta
from uuid import uuid4

from adreskopru.application.share_service import ShareService
from adreskopru.infrastructure.memory_share_repository import MemoryShareRepository


def test_revoked_share_is_not_publicly_accessible() -> None:
    service = ShareService(MemoryShareRepository())
    owner = "user-123"
    share = service.create(owner, uuid4(), datetime.now(UTC) + timedelta(hours=1))

    assert service.public_by_token(share.token) is not None
    service.revoke(share.id, owner)
    assert service.public_by_token(share.token) is None


def test_other_user_cannot_revoke_share() -> None:
    service = ShareService(MemoryShareRepository())
    share = service.create("owner", uuid4(), datetime.now(UTC) + timedelta(hours=1))

    assert service.revoke(share.id, "intruder") is None
    assert service.public_by_token(share.token) is not None

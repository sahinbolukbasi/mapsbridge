"""Use cases. Persistence is intentionally behind a port."""

from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID

from adreskopru.domain.share import Share

MAX_SHARE_LIFETIME = timedelta(days=7)


class ShareRepository(Protocol):
    def add(self, share: Share) -> None: ...
    def by_token(self, token: str) -> Share | None: ...
    def by_id(self, share_id: UUID) -> Share | None: ...
    def save(self, share: Share) -> None: ...


class ShareService:
    def __init__(self, repository: ShareRepository) -> None:
        self._repository = repository

    def create(self, owner_id: str, address_id: UUID, expires_at: datetime) -> Share:
        now = datetime.now(UTC)
        if expires_at <= now or expires_at - now > MAX_SHARE_LIFETIME:
            raise ValueError("Expiry must be between now and seven days")
        share = Share.create(owner_id=owner_id, address_id=address_id, expires_at=expires_at)
        self._repository.add(share)
        return share

    def public_by_token(self, token: str, now: datetime | None = None) -> Share | None:
        share = self._repository.by_token(token)
        if share is None or not share.is_accessible(now or datetime.now(UTC)):
            return None
        return share

    def revoke(self, share_id: UUID, requester_id: str) -> Share | None:
        share = self._repository.by_id(share_id)
        if share is None or share.owner_id != requester_id:
            return None
        revoked = share.revoke()
        self._repository.save(revoked)
        return revoked

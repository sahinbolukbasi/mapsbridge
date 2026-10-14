"""Domain rules for consent-based, time-limited shares."""

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from secrets import token_urlsafe
from uuid import UUID, uuid4


class ShareStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"


@dataclass(frozen=True, slots=True)
class Share:
    id: UUID
    owner_id: str
    token: str
    address_id: UUID
    expires_at: datetime
    status: ShareStatus

    @classmethod
    def create(cls, *, owner_id: str, address_id: UUID, expires_at: datetime) -> "Share":
        if expires_at <= datetime.now(UTC):
            raise ValueError("Share expiry must be in the future")
        # 32 random bytes gives 256 bits of entropy before URL-safe encoding.
        return cls(uuid4(), owner_id, token_urlsafe(32), address_id, expires_at, ShareStatus.ACTIVE)

    def is_accessible(self, now: datetime) -> bool:
        return self.status is ShareStatus.ACTIVE and now < self.expires_at

    def revoke(self) -> "Share":
        return Share(self.id, self.owner_id, self.token, self.address_id, self.expires_at, ShareStatus.REVOKED)

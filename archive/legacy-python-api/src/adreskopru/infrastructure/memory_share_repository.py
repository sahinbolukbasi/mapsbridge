"""Development adapter; production will use DynamoDB and encrypted payloads."""

from uuid import UUID

from adreskopru.domain.share import Share


class MemoryShareRepository:
    def __init__(self) -> None:
        self._by_token: dict[str, Share] = {}
        self._by_id: dict[UUID, Share] = {}

    def add(self, share: Share) -> None:
        self._by_token[share.token] = share
        self._by_id[share.id] = share

    def by_token(self, token: str) -> Share | None:
        return self._by_token.get(token)

    def by_id(self, share_id: UUID) -> Share | None:
        return self._by_id.get(share_id)

    def save(self, share: Share) -> None:
        self.add(share)

from uuid import UUID

from adreskopru.domain.address import Address


class MemoryAddressRepository:
    def __init__(self) -> None:
        self._addresses: dict[UUID, Address] = {}

    def add(self, address: Address) -> None:
        self._addresses[address.id] = address

    def list_by_owner(self, owner_id: str) -> list[Address]:
        return [address for address in self._addresses.values() if address.owner_id == owner_id]

    def by_id_and_owner(self, address_id: UUID, owner_id: str) -> Address | None:
        address = self._addresses.get(address_id)
        return address if address and address.owner_id == owner_id else None

    def delete(self, address_id: UUID, owner_id: str) -> bool:
        if self.by_id_and_owner(address_id, owner_id) is None:
            return False
        del self._addresses[address_id]
        return True

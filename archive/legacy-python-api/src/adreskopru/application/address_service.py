from decimal import Decimal
from typing import Protocol
from uuid import UUID

from adreskopru.domain.address import Address


class AddressRepository(Protocol):
    def add(self, address: Address) -> None: ...
    def list_by_owner(self, owner_id: str) -> list[Address]: ...
    def by_id_and_owner(self, address_id: UUID, owner_id: str) -> Address | None: ...
    def delete(self, address_id: UUID, owner_id: str) -> bool: ...


class AddressService:
    def __init__(self, repository: AddressRepository) -> None:
        self._repository = repository

    def create(self, owner_id: str, label: str, formatted_address: str, latitude: Decimal, longitude: Decimal) -> Address:
        address = Address.create(owner_id=owner_id, label=label, formatted_address=formatted_address, latitude=latitude, longitude=longitude)
        self._repository.add(address)
        return address

    def list(self, owner_id: str) -> list[Address]:
        return self._repository.list_by_owner(owner_id)

    def get(self, address_id: UUID, owner_id: str) -> Address | None:
        return self._repository.by_id_and_owner(address_id, owner_id)

    def delete(self, address_id: UUID, owner_id: str) -> bool:
        return self._repository.delete(address_id, owner_id)

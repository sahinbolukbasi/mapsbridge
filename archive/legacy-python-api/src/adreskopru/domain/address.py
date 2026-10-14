"""Address-book domain objects. Coordinates are always user-supplied choices."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass(frozen=True, slots=True)
class Address:
    id: UUID
    owner_id: str
    label: str
    formatted_address: str
    latitude: Decimal
    longitude: Decimal

    @classmethod
    def create(
        cls, *, owner_id: str, label: str, formatted_address: str, latitude: Decimal, longitude: Decimal
    ) -> "Address":
        normalized_label = label.strip()
        normalized_address = formatted_address.strip()
        if not normalized_label or not normalized_address:
            raise ValueError("Address label and formatted address are required")
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise ValueError("Coordinates are outside valid bounds")
        return cls(uuid4(), owner_id, normalized_label, normalized_address, latitude, longitude)

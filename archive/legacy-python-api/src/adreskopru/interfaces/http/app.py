from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from adreskopru.application.address_service import AddressService
from adreskopru.application.share_service import ShareService
from adreskopru.infrastructure.memory_address_repository import MemoryAddressRepository
from adreskopru.infrastructure.memory_share_repository import MemoryShareRepository

app = FastAPI(title="AdresKöprü API", version="0.1.0", docs_url=None, redoc_url=None)
service = ShareService(MemoryShareRepository())
addresses = AddressService(MemoryAddressRepository())


class CreateShareRequest(BaseModel):
    address_id: UUID
    expires_at: datetime


class CreateAddressRequest(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    formatted_address: str = Field(min_length=3, max_length=500)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)


class AddressResponse(BaseModel):
    id: UUID
    label: str
    formatted_address: str
    latitude: Decimal
    longitude: Decimal


def address_response(address: object) -> AddressResponse:
    return AddressResponse(
        id=address.id,  # type: ignore[attr-defined]
        label=address.label,  # type: ignore[attr-defined]
        formatted_address=address.formatted_address,  # type: ignore[attr-defined]
        latitude=address.latitude,  # type: ignore[attr-defined]
        longitude=address.longitude,  # type: ignore[attr-defined]
    )


class ShareResponse(BaseModel):
    id: UUID
    token: str | None = None
    expires_at: datetime
    status: str


def owner_id(request: Request) -> str:
    # TODO: Replace with an API Gateway/Cognito JWT dependency before production.
    subject = request.headers.get("x-dev-subject")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return subject


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/addresses", response_model=list[AddressResponse])
def list_addresses(request: Request) -> list[AddressResponse]:
    return [address_response(address) for address in addresses.list(owner_id(request))]


@app.post("/v1/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def create_address(body: CreateAddressRequest, request: Request) -> AddressResponse:
    try:
        address = addresses.create(owner_id(request), **body.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return address_response(address)


@app.delete("/v1/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: UUID, request: Request) -> None:
    if not addresses.delete(address_id, owner_id(request)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")


@app.post("/v1/shares", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
def create_share(body: CreateShareRequest, request: Request) -> ShareResponse:
    subject = owner_id(request)
    if addresses.get(body.address_id, subject) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    try:
        share = service.create(subject, body.address_id, body.expires_at)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return ShareResponse(id=share.id, token=share.token, expires_at=share.expires_at, status=share.status)


@app.get("/v1/shares/{token}", response_model=ShareResponse)
def get_public_share(token: str) -> ShareResponse:
    share = service.public_by_token(token)
    if not share:
        # Do not distinguish expired/revoked/nonexistent links.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not available")
    return ShareResponse(id=share.id, expires_at=share.expires_at, status=share.status)


@app.post("/v1/shares/{share_id}/revoke", response_model=ShareResponse)
def revoke_share(share_id: UUID, request: Request) -> ShareResponse:
    share = service.revoke(share_id, owner_id(request))
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not available")
    return ShareResponse(id=share.id, expires_at=share.expires_at, status=share.status)

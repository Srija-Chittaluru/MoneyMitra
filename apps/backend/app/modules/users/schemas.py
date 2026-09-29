import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """Safe, external-facing user representation. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    date_of_birth: date | None
    created_at: datetime

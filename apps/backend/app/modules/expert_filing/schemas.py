import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Plan = Literal["assisted", "premium"]
Status = Literal["pending", "contacted", "scheduled", "completed", "cancelled"]

# Single source of truth for pricing — the service reads this, so the client
# can't set its own price or call count.
PLAN_DETAILS: dict[Plan, dict[str, int]] = {
    "assisted": {"price": 499, "calls_included": 1},
    "premium": {"price": 1999, "calls_included": 1},
}


class ExpertFilingRequestIn(BaseModel):
    assessment_year: str
    plan: Plan
    contact_phone: str
    preferred_time: str | None = None


class ExpertFilingRequestOut(BaseModel):
    id: uuid.UUID
    assessment_year: str
    plan: Plan
    price: int
    calls_included: int
    status: Status
    contact_phone: str
    preferred_time: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

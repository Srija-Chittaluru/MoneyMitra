from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.expert_filing.models import ExpertFilingRequest
from app.modules.expert_filing.schemas import PLAN_DETAILS, ExpertFilingRequestIn, ExpertFilingRequestOut
from app.modules.users.models import User


def create_request(db: Session, user: User, payload: ExpertFilingRequestIn) -> ExpertFilingRequestOut:
    details = PLAN_DETAILS[payload.plan]
    request = ExpertFilingRequest(
        user_id=user.id,
        assessment_year=payload.assessment_year,
        plan=payload.plan,
        price=details["price"],
        calls_included=details["calls_included"],
        contact_phone=payload.contact_phone,
        preferred_time=payload.preferred_time,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return ExpertFilingRequestOut.model_validate(request)


def get_latest_request(db: Session, user: User, assessment_year: str) -> ExpertFilingRequestOut | None:
    request = db.scalar(
        select(ExpertFilingRequest)
        .where(ExpertFilingRequest.user_id == user.id, ExpertFilingRequest.assessment_year == assessment_year)
        .order_by(ExpertFilingRequest.created_at.desc())
        .limit(1)
    )
    return ExpertFilingRequestOut.model_validate(request) if request else None

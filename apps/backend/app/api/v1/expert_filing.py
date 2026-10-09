from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.expert_filing import service
from app.modules.expert_filing.schemas import ExpertFilingRequestIn, ExpertFilingRequestOut
from app.modules.users.models import User

router = APIRouter(prefix="/expert-filing", tags=["expert-filing"])


@router.post("/requests", response_model=ExpertFilingRequestOut)
def create_request(
    payload: ExpertFilingRequestIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpertFilingRequestOut:
    return service.create_request(db, current_user, payload)


@router.get("/requests/latest", response_model=ExpertFilingRequestOut | None)
def get_latest_request(
    assessment_year: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpertFilingRequestOut | None:
    return service.get_latest_request(db, current_user, assessment_year)

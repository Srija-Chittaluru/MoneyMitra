from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import TaxProfileRequest, UserPublic

router = APIRouter(prefix="/users/me", tags=["users"])


@router.put("/tax-profile", response_model=UserPublic)
def save_tax_profile(
    payload: TaxProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    user = service.save_tax_profile(db, current_user, payload.pan, payload.date_of_birth)
    return UserPublic.model_validate(user)


@router.post("/tax-onboarding/skip", response_model=UserPublic)
def skip_tax_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    user = service.skip_tax_onboarding(db, current_user)
    return UserPublic.model_validate(user)

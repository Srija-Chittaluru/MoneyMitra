from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.recommendations import profile, service
from app.modules.recommendations.profile import ProfileIn, ProfileOut
from app.modules.recommendations.schemas import RecommendationsOut
from app.modules.users.models import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationsOut)
def get_recommendations(
    tax_year: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendationsOut:
    return service.get_recommendations(db, current_user, tax_year)


@router.put("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    return profile.update_profile(db, current_user, payload)

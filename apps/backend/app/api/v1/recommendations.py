from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.recommendations import profile, service, status
from app.modules.recommendations.profile import ProfileIn, ProfileOut
from app.modules.recommendations.schemas import RecommendationsOut, RecommendationStatusIn, RecommendationStatusOut
from app.modules.users.models import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationsOut)
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendationsOut:
    return service.get_recommendations(db, current_user)


@router.put("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    return profile.update_profile(db, current_user, payload)


@router.put("/{recommendation_id}/status", response_model=RecommendationStatusOut)
def set_recommendation_status(
    recommendation_id: str,
    payload: RecommendationStatusIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendationStatusOut:
    return status.set_status(db, current_user, recommendation_id, payload.status)


@router.delete("/{recommendation_id}/status", status_code=204)
def clear_recommendation_status(
    recommendation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    status.clear_status(db, current_user, recommendation_id)

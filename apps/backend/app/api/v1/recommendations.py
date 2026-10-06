from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.recommendations import service
from app.modules.recommendations.schemas import LifeStageRecommendationsOut
from app.modules.users.models import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/life-stage", response_model=LifeStageRecommendationsOut)
def get_life_stage_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LifeStageRecommendationsOut:
    return service.get_life_stage_recommendations(db, current_user)

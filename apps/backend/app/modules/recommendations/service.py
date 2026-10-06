from datetime import date

from sqlalchemy.orm import Session

from app.modules.recommendations.context import load_financial_context
from app.modules.recommendations.schemas import LifeStageRecommendationsOut
from app.modules.recommendations.stages import STAGE_LABELS, calculate_age, resolve_life_stage
from app.modules.recommendations.templates import build_recommendations
from app.modules.users.models import User


def get_life_stage_recommendations(db: Session, user: User, today: date | None = None) -> LifeStageRecommendationsOut:
    if user.date_of_birth is None:
        return LifeStageRecommendationsOut(
            age=None, stage=None, stage_label=None, personalized=False, context_source=None, recommendations=[]
        )

    age = calculate_age(user.date_of_birth, today or date.today())
    stage = resolve_life_stage(age)
    context = load_financial_context(db, user)

    return LifeStageRecommendationsOut(
        age=age,
        stage=stage,
        stage_label=STAGE_LABELS[stage],
        personalized=context is not None,
        context_source=context.source if context else None,
        recommendations=build_recommendations(stage, context),
    )

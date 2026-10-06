from typing import Literal

from pydantic import BaseModel

from app.modules.recommendations.stages import LifeStage


class LifeStageRecommendation(BaseModel):
    id: str
    title: str
    description: str
    reason: str
    action_label: str
    action_href: str


class LifeStageRecommendationsOut(BaseModel):
    # All None when the user has no date of birth on file.
    age: int | None
    stage: LifeStage | None
    stage_label: str | None
    # True when the advice used the user's income/deduction data, not just
    # their age. `context_source` says where it came from.
    personalized: bool
    context_source: Literal["itr_filing", "tax_comparison"] | None
    recommendations: list[LifeStageRecommendation]

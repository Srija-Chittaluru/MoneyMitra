from typing import Literal

from pydantic import BaseModel

from app.modules.recommendations.profile import ProfileOut
from app.modules.recommendations.stages import LifeStage

Category = Literal["tax_saving", "life_stage"]


class LifeStageRecommendation(BaseModel):
    """What a life-stage template says, before the engine labels it."""

    id: str
    title: str
    description: str
    reason: str
    action_label: str
    action_href: str


class Recommendation(LifeStageRecommendation):
    category: Category
    # The data level this advice is built on: 1 = profile / general guidance,
    # 2 = the user's own income and deductions, 3 = their documents.
    level: int
    # One short line saying what the advice is based on, e.g. "Based on your ITR filing".
    basis: str


class NextStep(BaseModel):
    """What the user can provide to unlock the next, more specific level."""

    level: int
    title: str
    description: str
    action_label: str
    # None means "complete the profile card on this page".
    action_href: str | None


class AnalysedDocumentOut(BaseModel):
    category: str
    label: str
    file_name: str


class SkippedDocumentOut(BaseModel):
    category: str
    file_name: str
    reason: str


class DocumentsOut(BaseModel):
    """Which uploaded documents the advice is based on, and why others weren't used."""

    analysed: list[AnalysedDocumentOut]
    skipped: list[SkippedDocumentOut]


class RecommendationsOut(BaseModel):
    level: int
    level_label: str
    tax_year: str
    available_tax_years: list[str]
    profile: ProfileOut
    age: int | None
    stage: LifeStage | None
    stage_label: str | None
    context_source: Literal["itr_filing", "tax_comparison"] | None
    next_step: NextStep | None
    documents: DocumentsOut
    recommendations: list[Recommendation]

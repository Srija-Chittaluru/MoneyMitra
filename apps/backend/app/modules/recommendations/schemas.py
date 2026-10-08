from typing import Literal

from pydantic import BaseModel

from app.modules.recommendations.profile import ProfileOut
from app.modules.recommendations.stages import LifeStage


Category = Literal["tax_saving", "life_stage"]


class Option(BaseModel):
    """One place the money could go, described plainly (no specific product or fund)."""

    name: str
    summary: str
    risk: Literal["low", "medium", "high"]
    suits: str


class IllustrationLine(BaseModel):
    label: str
    value: str
    emphasis: bool = False


class Illustration(BaseModel):
    """Worked numbers that show what the advice is worth."""

    title: str
    lines: list[IllustrationLine]
    note: str
    # True when the figures use a sample income because the user's own isn't known yet.
    is_example: bool


class Recommendation(BaseModel):
    id: str
    # Recommendations shows life-stage advice only; Tax Planning builds its own tax-saving ones.
    category: Category = "life_stage"
    # The data level this advice is built on: 1 = profile / example figures,
    # 2 = the user's own income, 3 = their documents.
    level: int
    title: str
    description: str
    reason: str
    # One short line saying what the advice is based on, e.g. "Based on your ITR filing".
    basis: str
    steps: list[str] = []
    illustration: Illustration | None = None
    options: list[Option] = []
    action_label: str | None = None
    action_href: str | None = None


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
    profile: ProfileOut
    age: int | None
    stage: LifeStage | None
    stage_label: str | None
    context_source: Literal["itr_filing", "tax_comparison"] | None
    next_step: NextStep | None
    documents: DocumentsOut
    disclaimer: str
    recommendations: list[Recommendation]

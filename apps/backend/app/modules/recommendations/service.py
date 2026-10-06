from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.recommendations import engine
from app.modules.recommendations.facts import build_facts
from app.modules.recommendations.levels import LEVEL_LABELS
from app.modules.recommendations.profile import profile_of
from app.modules.recommendations.schemas import RecommendationsOut
from app.modules.recommendations.stages import STAGE_LABELS
from app.modules.tax.rules.registry import get_supported_tax_years
from app.modules.users.models import User


def get_recommendations(
    db: Session, user: User, tax_year: str | None = None, today: date | None = None
) -> RecommendationsOut:
    supported = get_supported_tax_years()
    tax_year = tax_year or supported[-1]
    if tax_year not in supported:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported tax year '{tax_year}'. Supported years: {', '.join(supported)}",
        )

    facts = build_facts(db, user, tax_year, today or date.today())
    return RecommendationsOut(
        level=int(facts.level),
        level_label=LEVEL_LABELS[facts.level],
        tax_year=tax_year,
        available_tax_years=supported,
        profile=profile_of(user),
        age=facts.age,
        stage=facts.stage,
        stage_label=STAGE_LABELS[facts.stage] if facts.stage else None,
        context_source=facts.declared.source if facts.declared else None,
        next_step=engine.next_step(facts),
        recommendations=engine.run(facts),
    )

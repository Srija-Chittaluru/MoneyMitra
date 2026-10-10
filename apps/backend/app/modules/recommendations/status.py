"""Whether a user has marked a recommendation done or dismissed. Recommendations
are computed fresh on every request (see engine.run), so a status is only valid
for an id the engine would actually generate for this user right now.
"""

from datetime import date

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.recommendations import engine
from app.modules.recommendations.facts import build_facts
from app.modules.recommendations.models import RecommendationStatus
from app.modules.recommendations.schemas import RecommendationStatusOut
from app.modules.users.models import User


def _valid_ids(db: Session, user: User) -> set[str]:
    facts = build_facts(db, user, date.today())
    return {rec.id for rec in engine.run(facts)}


def statuses_by_id(db: Session, user: User) -> dict[str, str]:
    rows = db.scalars(select(RecommendationStatus).where(RecommendationStatus.user_id == user.id))
    return {row.recommendation_id: row.status for row in rows}


def set_status(db: Session, user: User, recommendation_id: str, value: str) -> RecommendationStatusOut:
    if recommendation_id not in _valid_ids(db, user):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Recommendation not found")

    row = db.scalar(
        select(RecommendationStatus).where(
            RecommendationStatus.user_id == user.id,
            RecommendationStatus.recommendation_id == recommendation_id,
        )
    )
    if row is None:
        row = RecommendationStatus(user_id=user.id, recommendation_id=recommendation_id)
        db.add(row)
    row.status = value
    db.commit()
    return RecommendationStatusOut(recommendation_id=recommendation_id, status=value)


def clear_status(db: Session, user: User, recommendation_id: str) -> None:
    row = db.scalar(
        select(RecommendationStatus).where(
            RecommendationStatus.user_id == user.id,
            RecommendationStatus.recommendation_id == recommendation_id,
        )
    )
    if row is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Recommendation not found")
    db.delete(row)
    db.commit()

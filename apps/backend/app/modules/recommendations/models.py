import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RecommendationStatus(Base):
    """Whether a user has marked a life-stage recommendation done or dismissed.

    Recommendations themselves are computed fresh on every request (see
    engine.run); this just remembers what the user did with one, keyed by its
    stable id (e.g. "idle_money").
    """

    __tablename__ = "recommendation_statuses"
    __table_args__ = (UniqueConstraint("user_id", "recommendation_id", name="uq_recommendation_statuses_user_rec"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    recommendation_id: Mapped[str] = mapped_column(String(64))
    # "done" | "dismissed"
    status: Mapped[str] = mapped_column(String(16))

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

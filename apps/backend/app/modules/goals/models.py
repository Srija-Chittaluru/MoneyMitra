import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.goals.planner import MAX_GOAL_AMOUNT, MIN_GOAL_COST
from app.modules.goals.types import GoalStatus, GoalType


def _one_of(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(v.value) for v in values)})"


class Goal(Base):
    """A user's savings goal: only what they told us. The future cost, monthly
    amount and affordability are always worked out from these by the planner,
    never stored. Amounts are whole rupees, like every other money column."""

    __tablename__ = "goals"
    __table_args__ = (
        # Lets each contribution's (goal_id, user_id) point at its goal, so a
        # contribution can't belong to someone else's goal.
        UniqueConstraint("id", "user_id", name="uq_goals_id_user"),
        CheckConstraint("length(trim(title)) > 0", name="ck_goals_title_not_blank"),
        CheckConstraint(_one_of("goal_type", GoalType), name="ck_goals_goal_type"),
        CheckConstraint(_one_of("status", GoalStatus), name="ck_goals_status"),
        CheckConstraint(f"cost_today BETWEEN {MIN_GOAL_COST} AND {MAX_GOAL_AMOUNT}", name="ck_goals_cost_today"),
        CheckConstraint(f"existing_savings BETWEEN 0 AND {MAX_GOAL_AMOUNT}", name="ck_goals_existing_savings"),
        # completed_at is set exactly when the goal is completed.
        CheckConstraint(
            f"(status = '{GoalStatus.COMPLETED.value}') = (completed_at IS NOT NULL)", name="ck_goals_completed_at"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(100))
    goal_type: Mapped[str] = mapped_column(String(16))
    target_date: Mapped[date] = mapped_column(Date)
    cost_today: Mapped[int] = mapped_column(BigInteger)
    # Already put aside for this goal when it was set up, counted at face value.
    existing_savings: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        String(16), default=GoalStatus.ACTIVE.value, server_default=GoalStatus.ACTIVE.value
    )
    # Set when the goal is marked completed; NULL while active or archived.
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class GoalContribution(Base):
    """Money the user says they actually put towards a goal (not the planned monthly amount).

    A goal with contributions can't be deleted (archive it instead), so history
    isn't lost by accident. Deleting the user still removes everything: both
    tables cascade from `users`, and the goal check runs at the end of that delete."""

    __tablename__ = "goal_contributions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["goal_id", "user_id"], ["goals.id", "goals.user_id"], name="fk_goal_contributions_goal_user"
        ),
        CheckConstraint(f"amount BETWEEN 1 AND {MAX_GOAL_AMOUNT}", name="ck_goal_contributions_amount"),
        Index("ix_goal_contributions_goal_id_contributed_on", "goal_id", "contributed_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[int] = mapped_column(BigInteger)
    contributed_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

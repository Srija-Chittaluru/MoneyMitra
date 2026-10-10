"""Database rules for goals and goal contributions (run against Postgres)."""

import uuid
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import delete, inspect, select
from sqlalchemy.exc import IntegrityError

from app.modules.goals.affordability import LOAN_TERM_MONTHS
from app.modules.goals.models import Goal, GoalContribution
from app.modules.goals.planner import MAX_GOAL_AMOUNT, MIN_GOAL_COST
from app.modules.goals.types import GoalStatus, GoalType
from app.modules.users.models import User
from tests.conftest import TestSessionLocal, engine


NOW = datetime(2026, 10, 10, tzinfo=timezone.utc)


@pytest.fixture
def db():
    with TestSessionLocal() as session:
        yield session


def _user(db, email="goals@example.com") -> User:
    user = User(name="Goal Setter", email=email, password_hash="x")
    db.add(user)
    db.commit()
    return user


def _goal(db, user, **overrides) -> Goal:
    fields = {"user_id": user.id, "title": "Car", "goal_type": "car", "target_date": date(2027, 4, 15),
              "cost_today": 800_000}
    goal = Goal(**(fields | overrides))
    db.add(goal)
    db.commit()
    return goal


def _contribution(db, goal, amount=10_000, on=date(2026, 10, 31), user_id=None) -> GoalContribution:
    item = GoalContribution(goal_id=goal.id, user_id=user_id or goal.user_id, amount=amount, contributed_on=on)
    db.add(item)
    db.commit()
    return item


def _rejected(db, make) -> None:
    with pytest.raises(IntegrityError):
        make()
    db.rollback()


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------


def test_goal_defaults(db):
    goal = _goal(db, _user(db))
    db.refresh(goal)
    assert goal.status == GoalStatus.ACTIVE
    assert goal.existing_savings == 0
    assert goal.created_at is not None and goal.updated_at is not None


def test_every_goal_type_and_status_is_accepted(db):
    user = _user(db)
    for goal_type in GoalType:
        for goal_status in GoalStatus:
            completed_at = NOW if goal_status == GoalStatus.COMPLETED else None
            _goal(db, user, goal_type=goal_type.value, status=goal_status.value, completed_at=completed_at)
    assert db.scalar(select(Goal).where(Goal.goal_type == "efund")) is not None


@pytest.mark.parametrize(
    ("goal_status", "completed_at"),
    [("completed", None), ("active", "now"), ("archived", "now")],
)
def test_completed_at_is_set_exactly_when_completed(db, goal_status, completed_at):
    user = _user(db)
    _rejected(db, lambda: _goal(db, user, status=goal_status, completed_at=NOW if completed_at else None))


@pytest.mark.parametrize(
    "overrides",
    [
        {"cost_today": MIN_GOAL_COST - 1},
        {"cost_today": 0},
        {"cost_today": MAX_GOAL_AMOUNT + 1},
        {"existing_savings": -1},
        {"existing_savings": MAX_GOAL_AMOUNT + 1},
        {"goal_type": "yacht"},
        {"status": "deleted"},
        {"title": "   "},
    ],
)
def test_goal_constraints(db, overrides):
    user = _user(db)
    _rejected(db, lambda: _goal(db, user, **overrides))


def test_goal_limits_are_accepted(db):
    user = _user(db)
    _goal(db, user, cost_today=MIN_GOAL_COST, existing_savings=0)
    _goal(db, user, cost_today=MAX_GOAL_AMOUNT, existing_savings=MAX_GOAL_AMOUNT)


def test_only_car_and_house_goals_get_loan_illustrations():
    assert set(LOAN_TERM_MONTHS) == {GoalType.CAR, GoalType.HOUSE}


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


def test_contributions_come_back_in_date_order(db):
    goal = _goal(db, _user(db))
    for day in (date(2026, 12, 31), date(2026, 10, 31), date(2026, 11, 30)):
        _contribution(db, goal, on=day)
    dates = db.scalars(
        select(GoalContribution.contributed_on)
        .where(GoalContribution.goal_id == goal.id)
        .order_by(GoalContribution.contributed_on)
    ).all()
    assert dates == [date(2026, 10, 31), date(2026, 11, 30), date(2026, 12, 31)]


def test_contribution_lookup_by_goal_and_date_is_indexed():
    indexes = {ix["name"]: ix["column_names"] for ix in inspect(engine).get_indexes("goal_contributions")}
    assert indexes["ix_goal_contributions_goal_id_contributed_on"] == ["goal_id", "contributed_on"]


@pytest.mark.parametrize("amount", [0, -100, MAX_GOAL_AMOUNT + 1])
def test_contribution_amount_constraint(db, amount):
    goal = _goal(db, _user(db))
    _rejected(db, lambda: _contribution(db, goal, amount=amount))


def test_contribution_must_belong_to_an_existing_goal(db):
    user = _user(db)
    ghost = Goal(id=uuid.uuid4(), user_id=user.id)  # never saved
    _rejected(db, lambda: _contribution(db, ghost))


def test_contribution_cant_be_filed_under_someone_elses_goal(db):
    owner, other = _user(db), _user(db, "other@example.com")
    goal = _goal(db, owner)
    _rejected(db, lambda: _contribution(db, goal, user_id=other.id))


# ---------------------------------------------------------------------------
# Deleting
# ---------------------------------------------------------------------------


def test_goal_with_contributions_cant_be_deleted(db):
    goal = _goal(db, _user(db))
    _contribution(db, goal)
    _rejected(db, lambda: (db.execute(delete(Goal).where(Goal.id == goal.id)), db.commit()))
    assert db.scalar(select(GoalContribution).where(GoalContribution.goal_id == goal.id)) is not None


def test_goal_without_contributions_can_be_deleted(db):
    goal = _goal(db, _user(db))
    db.execute(delete(Goal).where(Goal.id == goal.id))
    db.commit()
    assert db.get(Goal, goal.id) is None


def test_deleting_a_user_removes_their_goals_and_contributions(db):
    user, keeper = _user(db), _user(db, "keeper@example.com")
    goal, kept = _goal(db, user), _goal(db, keeper)
    _contribution(db, goal)
    _contribution(db, kept)

    db.execute(delete(User).where(User.id == user.id))
    db.commit()

    assert [g.id for g in db.scalars(select(Goal))] == [kept.id]
    assert [c.goal_id for c in db.scalars(select(GoalContribution))] == [kept.id]

"""Goals and contributions for the signed-in user.

Every lookup is scoped to the user: another user's goal or contribution is
reported as missing, not forbidden. Plans and affordability are worked out on
each request by the planner and affordability modules from what's stored; no
projection is ever saved.

A goal's current funding is what was allocated at setup plus every recorded
contribution, counted at face value. It's passed to the planner as its
existing savings, so contributions reduce what's left to save.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.goals import affordability
from app.modules.goals.models import Goal, GoalContribution
from app.modules.goals.planner import MAX_GOAL_AMOUNT, GoalInputError, GoalInputs, GoalPlan, plan_goal
from app.modules.goals.schemas import (
    AffordabilityOut,
    ApproachOut,
    BreakdownOut,
    ContributionIn,
    GoalIn,
    GoalOut,
    LaterDateOut,
    LoanOut,
    LowerCostOut,
    PlanOut,
    ScheduleOut,
    TakeHomeOut,
)
from app.modules.goals.take_home import (
    TakeHome,
    confirmed_take_home,
    evidence_from_expected_income,
    evidence_from_itr,
    evidence_from_tax_comparison,
    resolve_take_home,
)
from app.modules.goals.types import GoalStatus
from app.modules.itr import service as itr_service
from app.modules.itr.rules import get_itr_rules
from app.modules.recommendations.context import load_latest_itr_draft, load_tax_comparison_context
from app.modules.recommendations.document_analysis import load_document_analysis
from app.modules.recommendations.money import format_inr as inr
from app.modules.users.models import User

GOAL_NOT_FOUND = "Goal not found"
CONTRIBUTION_NOT_FOUND = "Contribution not found"

# Which statuses each status can be reached from.
_TRANSITIONS = {
    GoalStatus.ACTIVE: {GoalStatus.COMPLETED, GoalStatus.ARCHIVED},
    GoalStatus.COMPLETED: {GoalStatus.ACTIVE},
    GoalStatus.ARCHIVED: {GoalStatus.ACTIVE, GoalStatus.COMPLETED},
}

TARGET_PASSED = "The target month has arrived. Move the target date, or mark the goal complete."

_NO_PLAN = {
    GoalStatus.COMPLETED: "This goal is completed. Reopen it to see a plan.",
    GoalStatus.ARCHIVED: "This goal is archived. Reopen it to see a plan.",
}


def _input_error(field: str, message: str) -> HTTPException:
    # The same shape as FastAPI's own validation errors.
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY, [{"loc": ["body", field], "msg": message, "type": "value_error"}]
    )


def _commit(db: Session, conflict: str) -> None:
    """Commits, turning a constraint violation into a 409 instead of a raw database error."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, conflict) from exc


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------


def get_goal(db: Session, user: User, goal_id: uuid.UUID) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, GOAL_NOT_FOUND)
    return goal


def _validate(payload: GoalIn, today: date) -> None:
    """The planner owns the rules for dates and amounts; reuse them as-is.
    Nothing to validate yet if either is still unset (the wizard allows that)."""
    if payload.target_date is None or payload.cost_today is None:
        return
    try:
        plan_goal(
            GoalInputs(payload.target_date, payload.cost_today, payload.existing_savings, payload.loan_pct), today
        )
    except GoalInputError as error:
        raise _input_error(error.field, str(error)) from error


def _apply(goal: Goal, payload: GoalIn) -> None:
    goal.title = payload.title
    goal.goal_type = payload.goal_type.value
    goal.target_date = payload.target_date
    goal.cost_today = payload.cost_today
    goal.existing_savings = payload.existing_savings
    goal.loan_pct = payload.loan_pct


def create_goal(db: Session, user: User, payload: GoalIn, today: date | None = None) -> Goal:
    _validate(payload, today or date.today())
    goal = Goal(user_id=user.id)
    _apply(goal, payload)
    db.add(goal)
    _commit(db, "This goal couldn't be saved.")
    db.refresh(goal)
    return goal


def update_goal(db: Session, goal: Goal, payload: GoalIn, today: date | None = None) -> Goal:
    if goal.status != GoalStatus.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen this goal to edit it.")
    _validate(payload, today or date.today())
    _apply(goal, payload)
    _commit(db, "This goal couldn't be saved.")
    db.refresh(goal)
    return goal


def set_status(db: Session, goal: Goal, new_status: GoalStatus) -> Goal:
    current = GoalStatus(goal.status)
    if current == new_status:
        return goal
    if current not in _TRANSITIONS[new_status]:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A {current.value} goal can't be marked {new_status.value}.")
    goal.status = new_status.value
    goal.completed_at = datetime.now(timezone.utc) if new_status == GoalStatus.COMPLETED else None
    _commit(db, "This goal couldn't be updated.")
    db.refresh(goal)
    return goal


HAS_CONTRIBUTIONS = (
    "This goal has recorded contributions, so it can't be deleted. Archive it instead to keep its history."
)


def delete_goal(db: Session, goal: Goal) -> None:
    if db.scalar(select(exists().where(GoalContribution.goal_id == goal.id))):
        raise HTTPException(status.HTTP_409_CONFLICT, HAS_CONTRIBUTIONS)
    db.delete(goal)
    _commit(db, HAS_CONTRIBUTIONS)  # a contribution recorded in the meantime


def reorder_goals(db: Session, user: User, goal_ids: list[uuid.UUID]) -> list[Goal]:
    """Sets priority = position in `goal_ids` for every goal named. Every id must
    belong to the caller — same 404-not-403 ownership style as `get_goal`."""
    goals = {goal.id: goal for goal in db.scalars(select(Goal).where(Goal.user_id == user.id))}
    missing = [str(goal_id) for goal_id in goal_ids if goal_id not in goals]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, GOAL_NOT_FOUND)
    for index, goal_id in enumerate(goal_ids):
        goals[goal_id].priority = index
    _commit(db, "The new order couldn't be saved.")
    return [goals[goal_id] for goal_id in goal_ids]


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


def list_contributions(db: Session, goal: Goal) -> list[GoalContribution]:
    return list(
        db.scalars(
            select(GoalContribution)
            .where(GoalContribution.goal_id == goal.id, GoalContribution.user_id == goal.user_id)
            .order_by(GoalContribution.contributed_on, GoalContribution.created_at)
        )
    )


def get_contribution(db: Session, goal: Goal, contribution_id: uuid.UUID) -> GoalContribution:
    item = db.get(GoalContribution, contribution_id)
    if item is None or item.goal_id != goal.id or item.user_id != goal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, CONTRIBUTION_NOT_FOUND)
    return item


def _check_contribution(goal: Goal, payload: ContributionIn, today: date) -> None:
    if goal.status != GoalStatus.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen this goal to change its contributions.")
    if not 1 <= payload.amount <= MAX_GOAL_AMOUNT:
        raise _input_error("amount", f"Enter an amount between ₹1 and {inr(MAX_GOAL_AMOUNT)}.")
    if payload.contributed_on > today:
        raise _input_error("contributed_on", "A contribution can't be dated in the future.")


def _touch(goal: Goal) -> None:
    """A change to a goal's contributions counts as a change to the goal."""
    goal.updated_at = func.now()


def add_contribution(
    db: Session, goal: Goal, payload: ContributionIn, today: date | None = None
) -> GoalContribution:
    _check_contribution(goal, payload, today or date.today())
    item = GoalContribution(
        goal_id=goal.id, user_id=goal.user_id,
        amount=payload.amount, contributed_on=payload.contributed_on, note=payload.note,
    )
    db.add(item)
    _touch(goal)
    _commit(db, "This contribution couldn't be saved.")
    db.refresh(item)
    return item


def update_contribution(
    db: Session, goal: Goal, item: GoalContribution, payload: ContributionIn, today: date | None = None
) -> GoalContribution:
    _check_contribution(goal, payload, today or date.today())
    item.amount = payload.amount
    item.contributed_on = payload.contributed_on
    item.note = payload.note
    _touch(goal)
    _commit(db, "This contribution couldn't be saved.")
    db.refresh(item)
    return item


def delete_contribution(db: Session, goal: Goal, item: GoalContribution) -> None:
    if goal.status != GoalStatus.ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen this goal to change its contributions.")
    db.delete(item)
    _touch(goal)
    _commit(db, "This contribution couldn't be deleted.")


# ---------------------------------------------------------------------------
# Plans and affordability
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Planned:
    goal: Goal
    contributions_total: int
    plan: GoalPlan | None
    issue: str | None

    @property
    def funding(self) -> int:
        return self.goal.existing_savings + self.contributions_total


def _contribution_totals(db: Session, user: User) -> dict[uuid.UUID, int]:
    """Every goal's contribution total in one query, rather than one per goal."""
    rows = db.execute(
        select(GoalContribution.goal_id, func.sum(GoalContribution.amount))
        .where(GoalContribution.user_id == user.id)
        .group_by(GoalContribution.goal_id)
    )
    return {goal_id: int(total) for goal_id, total in rows}


NEEDS_INPUT = "Set a target date and amount to see a plan."


def _plan(goal: Goal, contributions_total: int, today: date) -> _Planned:
    goal_status = GoalStatus(goal.status)
    if goal_status != GoalStatus.ACTIVE:
        return _Planned(goal, contributions_total, None, _NO_PLAN[goal_status])
    if goal.target_date is None or goal.cost_today is None:
        return _Planned(goal, contributions_total, None, NEEDS_INPUT)
    # Funding above the planner's limit is far beyond any goal; capping it only
    # understates funding, so the plan errs towards saving more.
    funding = min(goal.existing_savings + contributions_total, MAX_GOAL_AMOUNT)
    try:
        plan = plan_goal(GoalInputs(goal.target_date, goal.cost_today, funding, goal.loan_pct), today)
    except GoalInputError as error:
        issue = TARGET_PASSED if error.field == "target_date" else str(error)
        return _Planned(goal, contributions_total, None, issue)
    return _Planned(goal, contributions_total, plan, None)


def _take_home(db: Session, user: User, today: date) -> TakeHome:
    """The user's own take-home if they've given one; otherwise the best estimate
    from their ITR, documents, tax comparison and expected income, in that order."""
    if user.monthly_take_home is not None:
        return confirmed_take_home(user.monthly_take_home)

    evidence = []
    if (loaded := load_latest_itr_draft(db, user)) is not None:
        filing, draft = loaded
        if (rules := get_itr_rules(filing.assessment_year)) is not None:
            if found := evidence_from_itr(draft, itr_service.build_summary(draft, rules, today)):
                evidence.append(found)
    documents = load_document_analysis(db, user, today)
    if documents.usable and documents.draft is not None and documents.summary is not None:
        if found := evidence_from_itr(documents.draft, documents.summary, source="documents"):
            evidence.append(found)
    if (comparison := load_tax_comparison_context(db, user)) is not None:
        evidence.append(evidence_from_tax_comparison(comparison))
    if user.expected_annual_income:
        evidence.append(evidence_from_expected_income(user.expected_annual_income, today, user.date_of_birth))
    return resolve_take_home(today, evidence)


def _commitments(planned: list[_Planned]) -> list[affordability.Commitment] | None:
    """Every active goal's planned monthly amount. None if any can't be worked out,
    so affordability stays unknown rather than leaving one out."""
    items = []
    for entry in planned:
        if entry.goal.status != GoalStatus.ACTIVE:
            continue
        if entry.plan is None:
            return None
        items.append(affordability.Commitment(str(entry.goal.id), entry.plan.monthly_needed))
    return items


def _plan_out(plan: GoalPlan) -> PlanOut:
    return PlanOut(
        months=plan.months,
        inflation_rate=plan.inflation_rate,
        future_cost=plan.future_cost,
        funding_counted=plan.existing_savings,
        financed_by_loan=plan.financed_by_loan,
        remaining=plan.remaining,
        approach=ApproachOut.model_validate(plan.approach),
        monthly_needed=plan.monthly_needed,
        assumptions=plan.assumptions,
        disclosure=plan.disclosure,
    )


def _affordability_out(result: affordability.Assessment, take_home: TakeHome) -> AffordabilityOut:
    def maybe(schema, value):
        return schema.model_validate(value) if value is not None else None

    return AffordabilityOut(
        status=result.status.value,
        reasons=result.reasons,
        take_home=TakeHomeOut.model_validate(take_home),
        schedule=maybe(ScheduleOut, result.schedule),
        breakdown=maybe(BreakdownOut, result.breakdown),
        later_date=maybe(LaterDateOut, result.later_date),
        lower_cost=maybe(LowerCostOut, result.lower_cost),
        loan=maybe(LoanOut, result.loan),
        notes=result.notes,
    )


def goals_out(
    db: Session, user: User, today: date | None = None, *, only: uuid.UUID | None = None,
    include_archived: bool = True,
) -> list[GoalOut]:
    """All the user's goals with their plans, or just goal `only`. Other goals are
    always loaded, since their monthly amounts count against this one's."""
    today = today or date.today()
    goals = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.priority, Goal.created_at))
    totals = _contribution_totals(db, user)
    planned = [_plan(goal, totals.get(goal.id, 0), today) for goal in goals]

    take_home: TakeHome | None = None
    commitments = _commitments(planned)
    results = []
    for entry in planned:
        goal = entry.goal
        if only is not None and goal.id != only:
            continue
        if not include_archived and goal.status == GoalStatus.ARCHIVED:
            continue
        assessed = None
        if entry.plan is not None:
            take_home = take_home or _take_home(db, user, today)
            capacity = affordability.Capacity(take_home, user.monthly_expenses, commitments)
            result = affordability.assess(
                entry.plan, capacity, today, goal_key=str(goal.id), goal_type=goal.goal_type
            )
            assessed = _affordability_out(result, take_home)
        results.append(
            GoalOut(
                id=goal.id,
                title=goal.title,
                goal_type=goal.goal_type,
                target_date=goal.target_date,
                cost_today=goal.cost_today,
                existing_savings=goal.existing_savings,
                loan_pct=goal.loan_pct,
                priority=goal.priority,
                status=goal.status,
                completed_at=goal.completed_at,
                created_at=goal.created_at,
                updated_at=goal.updated_at,
                contributions_total=entry.contributions_total,
                current_funding=entry.funding,
                plan=_plan_out(entry.plan) if entry.plan else None,
                plan_issue=entry.issue,
                affordability=assessed,
            )
        )
    return results


def goal_out(db: Session, user: User, goal: Goal, today: date | None = None) -> GoalOut:
    return goals_out(db, user, today, only=goal.id)[0]

"""Affordability and alternatives in goals/affordability.py."""

from datetime import date

import pytest

from app.modules.goals.affordability import (
    HEADROOM_SHARE,
    LOAN_TERM_MONTHS,
    Capacity,
    Commitment,
    Status,
    assess,
    contribution_schedule,
    later_date,
    lower_cost,
)
from app.modules.goals.planner import GoalInputs, plan_goal
from app.modules.goals.take_home import IncomeEvidence, Reliability, TakeHome, confirmed_take_home, estimate_take_home
from app.modules.recommendations import wealth

TODAY = date(2026, 10, 9)


def _plan(target=date(2027, 4, 15), cost=800_000, savings=300_000):
    # The car example: 6 months, Rs 86,200 a month.
    return plan_goal(GoalInputs(target_date=target, cost_today=cost, existing_savings=savings), TODAY)


def _capacity(take_home=150_000, expenses=50_000, commitments=()):
    take = take_home if isinstance(take_home, TakeHome) else confirmed_take_home(take_home)
    return Capacity(take, expenses, list(commitments) if commitments is not None else None)


def _assess(plan=None, capacity=None, **kwargs):
    return assess(plan or _plan(), capacity or _capacity(), TODAY, **kwargs)


# ---------------------------------------------------------------------------
# The four statuses
# ---------------------------------------------------------------------------


def test_affordable_when_it_fits_with_headroom():
    # 1,50,000 - 40,000 = 1,10,000 available; 1,10,000 - 15,000 headroom = 95,000 comfortable.
    result = _assess(capacity=_capacity(expenses=40_000))
    assert result.status == Status.AFFORDABLE
    assert result.breakdown.available == 110_000
    assert result.breakdown.comfortable == 95_000
    assert result.later_date is None and result.lower_cost is None and result.loan is None


def test_tight_when_it_fits_only_without_headroom():
    # 1,00,000 available, 85,000 comfortable, 86,200 needed.
    result = _assess(capacity=_capacity(expenses=50_000), goal_type="car")
    assert result.status == Status.TIGHT
    assert result.breakdown.comfortable < 86_200 <= result.breakdown.available
    assert result.later_date is not None and result.lower_cost is not None and result.loan is not None


def test_unaffordable_when_it_needs_more_than_is_available():
    result = _assess(capacity=_capacity(take_home=120_000, expenses=72_000))
    assert result.status == Status.UNAFFORDABLE
    assert result.breakdown.available == 48_000
    assert "₹48,000" in result.reasons[0]


def test_unknown_without_reliable_take_home():
    result = _assess(capacity=_capacity(take_home=TakeHome(Reliability.UNAVAILABLE, None)))
    assert result.status == Status.UNKNOWN
    assert result.breakdown is None
    assert "take-home" in result.reasons[0]
    assert result.later_date is None and result.lower_cost is None and result.loan is None


def test_headroom_threshold_is_a_share_of_take_home():
    breakdown = _assess(capacity=_capacity(take_home=200_000, expenses=0)).breakdown
    assert breakdown.available - breakdown.comfortable == 200_000 * HEADROOM_SHARE


# ---------------------------------------------------------------------------
# Income reliability
# ---------------------------------------------------------------------------


def _estimate(**overrides):
    fields = {"source": "tax_comparison", "financial_year": "2026-27", "annual_gross": 2_400_000,
              "annual_tax": 300_000, "annual_professional_tax": None}
    return estimate_take_home(IncomeEvidence(**(fields | overrides)), TODAY)


def test_current_estimated_income_gives_a_firm_status_with_disclosures():
    take_home = _estimate()  # (24,00,000 - 3,00,000 - 2,500) / 12 = 1,74,791
    result = _assess(capacity=_capacity(take_home=take_home, expenses=60_000))
    assert result.status == Status.AFFORDABLE
    assert result.breakdown.take_home == 174_791
    assert any("FY 2026-27" in note for note in result.notes)
    assert any("likely to be lower" in note for note in result.notes)


def test_stale_income_is_unknown_with_an_indication():
    result = _assess(capacity=_capacity(take_home=_estimate(financial_year="2025-26"), expenses=60_000))
    assert result.status == Status.UNKNOWN
    assert "FY 2025-26" in result.reasons[0]
    assert result.breakdown.take_home == 174_791  # shown, but no claim made


def test_expected_income_only_is_unknown_and_asks_for_take_home():
    result = _assess(capacity=_capacity(take_home=_estimate(source="profile"), expenses=60_000))
    assert result.status == Status.UNKNOWN
    assert "expected income" in result.reasons[0]
    assert "Confirm your monthly take-home" in result.reasons[0]


def test_incomplete_income_is_unknown():
    result = _assess(capacity=_capacity(take_home=_estimate(annual_tax=None)))
    assert result.status == Status.UNKNOWN
    assert result.breakdown is None


# ---------------------------------------------------------------------------
# Expenses and commitments
# ---------------------------------------------------------------------------


def test_commitments_are_subtracted_once_and_never_for_this_goal():
    commitments = [Commitment("bike", 10_000), Commitment("bike", 10_000), Commitment("this", 86_200)]
    result = _assess(capacity=_capacity(expenses=30_000, commitments=commitments), goal_key="this")
    assert result.breakdown.commitments == 10_000
    assert result.breakdown.available == 150_000 - 30_000 - 10_000


def test_commitments_can_tip_a_goal_over():
    fits = _assess(capacity=_capacity(expenses=30_000))
    over = _assess(capacity=_capacity(expenses=30_000, commitments=[Commitment("house", 40_000)]))
    assert fits.status == Status.AFFORDABLE
    assert over.status == Status.UNAFFORDABLE


def test_missing_expenses_leave_it_unknown_with_an_illustrative_figure():
    result = _assess(capacity=_capacity(expenses=None))
    assert result.status == Status.UNKNOWN
    assert any("expenses" in reason for reason in result.reasons)
    assert result.breakdown.expenses_estimated
    assert result.breakdown.expenses == 150_000 * wealth.EXPENSE_SHARE
    assert any("illustration" in note for note in result.notes)


def test_missing_commitments_leave_it_unknown():
    result = _assess(capacity=_capacity(commitments=None))
    assert result.status == Status.UNKNOWN
    assert any("other goals" in reason for reason in result.reasons)


def test_negative_inputs_are_rejected():
    with pytest.raises(ValueError):
        _assess(capacity=_capacity(expenses=-1))
    with pytest.raises(ValueError):
        _assess(capacity=_capacity(commitments=[Commitment("x", -5)]))


def test_savings_that_cover_the_goal_need_no_income_check():
    plan = _plan(savings=900_000)
    result = _assess(plan=plan, capacity=_capacity(take_home=TakeHome(Reliability.UNAVAILABLE, None)))
    assert result.status == Status.AFFORDABLE
    assert result.schedule is None


# ---------------------------------------------------------------------------
# Alternatives
# ---------------------------------------------------------------------------


def _month_start(months_ahead: int) -> date:
    index = TODAY.year * 12 + TODAY.month - 1 + months_ahead
    return date(index // 12, index % 12 + 1, 1)


def _unaffordable(**kwargs):
    # 48,000 available, 36,000 comfortable: the budget for alternatives.
    return _assess(capacity=_capacity(take_home=120_000, expenses=72_000), **kwargs)


def test_later_date_is_the_soonest_month_that_fits():
    plan, result = _plan(), _unaffordable()
    later = result.later_date
    assert later.months > plan.months
    assert later.monthly_needed <= 36_000
    assert later.target_date.day == 1
    assert wealth.months_until(later.target_date, TODAY) == later.months
    # A month sooner doesn't fit.
    if later.months - 1 > plan.months:
        assert plan_goal(GoalInputs(_month_start(later.months - 1), 800_000, 300_000), TODAY).monthly_needed > 36_000
    # Inflation has raised the cost by then, too.
    assert later.future_cost > plan.future_cost


def test_lower_cost_is_the_most_that_fits_by_the_same_date():
    plan, result = _plan(), _unaffordable()
    lower = result.lower_cost
    assert lower.cost_today < plan.cost_today
    assert lower.cost_today % 1_000 == 0
    assert lower.monthly_needed <= 36_000
    one_step_more = plan_goal(GoalInputs(plan.target_date, lower.cost_today + 1_000, 300_000), TODAY)
    assert one_step_more.monthly_needed > 36_000


def test_tight_alternatives_aim_for_the_comfortable_amount():
    result = _assess(capacity=_capacity(expenses=50_000))  # comfortable 85,000
    assert result.later_date.monthly_needed <= 85_000
    assert result.lower_cost.monthly_needed <= 85_000


def test_zero_capacity_has_no_later_date_but_a_savings_only_cost():
    result = _assess(capacity=_capacity(take_home=50_000, expenses=50_000), goal_type="car")
    assert result.status == Status.UNAFFORDABLE
    assert result.breakdown.available == 0
    assert result.later_date is None
    # Only what's already saved: 3,00,000 / 1.06 ** 0.5, rounded down to the thousand.
    assert result.lower_cost.cost_today == 291_000
    assert result.lower_cost.monthly_needed == 0
    assert result.loan.monthly_savings == 0
    assert result.loan.down_payment == 300_000


def test_zero_capacity_and_no_savings_has_no_alternatives():
    plan = _plan(savings=0)
    result = _assess(plan=plan, capacity=_capacity(take_home=50_000, expenses=60_000))
    assert result.status == Status.UNAFFORDABLE
    assert result.breakdown.available == -10_000
    assert "₹0" in result.reasons[0]
    assert result.later_date is None and result.lower_cost is None


def test_no_later_date_within_forty_years_returns_none():
    plan = _plan(target=date(2066, 1, 1), cost=100_000_000, savings=0)
    assert later_date(plan, TODAY, budget=100) is None


def test_lower_cost_below_the_minimum_returns_none():
    plan = _plan(savings=0)
    assert lower_cost(plan, TODAY, budget=0) is None


# ---------------------------------------------------------------------------
# Loan illustration
# ---------------------------------------------------------------------------


def test_loan_illustration_for_a_car():
    plan, result = _plan(), _unaffordable(goal_type="car")
    loan = result.loan
    assert loan.annual_rate == wealth.LOAN_RATE == 0.09
    assert loan.term_months == LOAN_TERM_MONTHS["car"] == 60
    assert loan.monthly_savings == 36_000
    saved = wealth.fv_sip_months(36_000, plan.approach.annual_rate, plan.months)
    assert loan.down_payment == int(300_000 + saved)
    assert loan.down_payment + loan.loan_amount == plan.future_cost
    assert loan.emi == wealth.round_up_to(wealth.emi(loan.loan_amount, 0.09, 60), 1)
    assert loan.total_interest > 0
    assert loan.emi_fits == (loan.emi <= 36_000)
    assert "not a recommendation" in loan.note


def test_house_loans_use_a_longer_term():
    plan = _plan(target=date(2031, 4, 1), cost=8_000_000, savings=1_000_000)
    result = _assess(plan=plan, capacity=_capacity(take_home=200_000, expenses=100_000), goal_type="house")
    assert result.status == Status.UNAFFORDABLE
    assert result.loan.term_months == 240


@pytest.mark.parametrize("goal_type", [None, "vacation", "education"])
def test_no_loan_for_other_goals(goal_type):
    assert _unaffordable(goal_type=goal_type).loan is None


def test_tight_goal_loan_saves_the_comfortable_amount_first():
    # 87,000 available fits 86,200, but only 72,000 is comfortable: the loan covers the rest.
    plan = _plan()
    result = _assess(capacity=_capacity(take_home=150_000, expenses=63_000), goal_type="car")
    assert result.status == Status.TIGHT
    assert result.loan.monthly_savings == 72_000
    assert result.loan.loan_amount == plan.future_cost - result.loan.down_payment > 0


# ---------------------------------------------------------------------------
# Contribution timing
# ---------------------------------------------------------------------------


def test_schedule_explains_when_contributions_fall_due():
    schedule = contribution_schedule(_plan(), TODAY)
    assert schedule.count == 6
    assert schedule.first_due == date(2026, 10, 31)
    assert schedule.last_due == date(2027, 3, 31)
    assert "6 monthly contributions of ₹86,200" in schedule.description
    assert "31 Oct 2026" in schedule.description and "31 Mar 2027" in schedule.description
    assert "due in" not in schedule.description


def test_schedule_warns_when_the_first_contribution_is_days_away():
    late = date(2026, 10, 28)
    plan = plan_goal(GoalInputs(date(2027, 4, 15), 800_000, 300_000), late)
    schedule = contribution_schedule(plan, late)
    assert schedule.first_due == date(2026, 10, 31)
    assert "The first is due in 3 days." in schedule.description


def test_schedule_for_a_one_month_goal():
    plan = plan_goal(GoalInputs(date(2026, 11, 20), 50_000, 0), date(2026, 10, 31))
    schedule = contribution_schedule(plan, date(2026, 10, 31))
    assert schedule.count == 1
    assert schedule.first_due == schedule.last_due == date(2026, 10, 31)
    assert schedule.description.startswith("One contribution")
    assert "due today" in schedule.description


def test_schedule_is_part_of_every_assessment_that_needs_money():
    assert _assess().schedule.count == 6
    assert _assess(capacity=_capacity(expenses=None)).schedule is not None

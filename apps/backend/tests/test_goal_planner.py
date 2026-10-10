"""The pure goal planner in goals/planner.py."""

from datetime import date

import pytest

from app.modules.goals.planner import (
    GOAL_DISCLOSURE,
    MAX_GOAL_AMOUNT,
    MIN_GOAL_COST,
    GoalInputError,
    GoalInputs,
    plan_goal,
)
from app.modules.recommendations import wealth

TODAY = date(2026, 10, 9)


def _plan(target=date(2027, 4, 15), cost=800_000, savings=0, **kwargs):
    return plan_goal(GoalInputs(target_date=target, cost_today=cost, existing_savings=savings), TODAY, **kwargs)


# ---------------------------------------------------------------------------
# The worked example: a car in April 2027
# ---------------------------------------------------------------------------


def test_six_month_goal_uses_the_safe_bucket():
    plan = _plan(savings=300_000)
    assert plan.months == 6
    assert plan.approach.key == "short_term"
    assert plan.approach.annual_rate == wealth.SAFE_RATE
    assert plan.approach.risk == "low"
    # 8,00,000 x 1.06 ** 0.5 = 8,23,650.41, rounded up to the rupee.
    assert plan.future_cost == 823_651
    assert plan.remaining == 823_651 - 300_000
    # 5,23,651 over 6 months at 6.5% is 86,100.76 a month, rounded up to 86,200.
    assert plan.monthly_needed == 86_200


def test_ten_year_goal_uses_the_growth_bucket():
    plan = _plan(target=date(2036, 10, 1), cost=1_000_000)
    assert plan.months == 120
    assert plan.approach.key == "long_term"
    assert plan.approach.annual_rate == wealth.GROWTH_RATE
    assert plan.future_cost == 1_790_848
    assert plan.monthly_needed == 8_800


def test_medium_goal_uses_the_balanced_bucket():
    plan = _plan(target=date(2030, 10, 1))
    assert plan.months == 48
    assert plan.approach.key == "medium_term"
    assert plan.approach.annual_rate == wealth.BALANCED_RATE


# ---------------------------------------------------------------------------
# Inflation and existing savings
# ---------------------------------------------------------------------------


def test_future_cost_uses_yearly_inflation_over_fractional_years():
    # 18 months: 1.5 years of 6% yearly price rises, not 18 monthly compoundings of 0.5%.
    plan = _plan(target=date(2028, 4, 1), cost=1_000_000)
    assert plan.months == 18
    assert plan.future_cost == 1_091_337  # 10,00,000 x 1.06 ** 1.5 = 10,91,336.79
    assert plan.future_cost < 1_000_000 * (1 + 0.06 / 12) ** 18


def test_inflation_rate_is_configurable():
    assert _plan(cost=1_000_000, inflation_rate=0).future_cost == 1_000_000
    assert _plan(cost=1_000_000, inflation_rate=0.10).future_cost > _plan(cost=1_000_000).future_cost


def test_existing_savings_count_at_face_value():
    without = _plan(target=date(2036, 10, 1), cost=1_000_000)
    with_savings = _plan(target=date(2036, 10, 1), cost=1_000_000, savings=400_000)
    assert with_savings.existing_savings == 400_000
    # Taken off the future cost exactly as entered, with ten years of no growth.
    assert with_savings.remaining == without.future_cost - 400_000
    assert with_savings.monthly_needed < without.monthly_needed


@pytest.mark.parametrize("savings", [823_651, 900_000])
def test_savings_that_already_cover_the_goal_need_nothing_more(savings):
    plan = _plan(savings=savings)
    assert plan.remaining == 0
    assert plan.monthly_needed == 0


def test_one_rupee_short_still_needs_a_monthly_amount():
    plan = _plan(savings=823_650)
    assert plan.remaining == 1
    assert plan.monthly_needed == 100


# ---------------------------------------------------------------------------
# Rounding
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("target", "cost", "savings"),
    [
        (date(2026, 11, 1), 50_000, 0),
        (date(2027, 4, 15), 800_000, 300_000),
        (date(2029, 6, 1), 2_000_000, 150_000),
        (date(2046, 1, 1), 5_000_000, 0),
        (date(2066, 10, 1), 100_000_000, 1_000_000),
    ],
)
def test_monthly_savings_round_up_and_reach_the_goal(target, cost, savings):
    plan = _plan(target=target, cost=cost, savings=savings)
    exact = wealth.monthly_needed_months(plan.remaining, plan.approach.annual_rate, plan.months)
    assert plan.monthly_needed % 100 == 0
    assert exact <= plan.monthly_needed < exact + 100
    reached = wealth.fv_sip_months(plan.monthly_needed, plan.approach.annual_rate, plan.months)
    assert round(reached, 2) >= plan.remaining


def test_one_month_goal_needs_the_remaining_amount_rounded_up():
    plan = _plan(target=date(2026, 11, 30), cost=50_050)
    assert plan.months == 1
    assert plan.future_cost == 50_294  # 50,050 x 1.06 ** (1/12) = 50,293.62
    assert plan.monthly_needed == 50_300


# ---------------------------------------------------------------------------
# Rejected inputs
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "target",
    [
        date(2026, 10, 31),  # later this month
        date(2026, 10, 9),  # today
        date(2026, 3, 1),  # in the past
        date(2066, 11, 1),  # 481 months away
    ],
)
def test_targets_outside_one_to_480_months_are_rejected(target):
    with pytest.raises(GoalInputError) as error:
        _plan(target=target)
    assert error.value.field == "target_date"


def test_horizon_edges_are_accepted():
    assert _plan(target=date(2026, 11, 1)).months == 1
    assert _plan(target=date(2066, 10, 31)).months == 480


@pytest.mark.parametrize("cost", [0, -1, MIN_GOAL_COST - 1, MAX_GOAL_AMOUNT + 1, 10**15, 800_000.5, True])
def test_invalid_costs_are_rejected(cost):
    with pytest.raises(GoalInputError) as error:
        _plan(cost=cost)
    assert error.value.field == "cost_today"


@pytest.mark.parametrize("savings", [-1, MAX_GOAL_AMOUNT + 1, 1.5, False])
def test_invalid_savings_are_rejected(savings):
    with pytest.raises(GoalInputError) as error:
        _plan(savings=savings)
    assert error.value.field == "existing_savings"


def test_limits_are_accepted():
    assert _plan(cost=MIN_GOAL_COST).monthly_needed == 100
    assert _plan(cost=MAX_GOAL_AMOUNT, savings=MAX_GOAL_AMOUNT).existing_savings == MAX_GOAL_AMOUNT


# ---------------------------------------------------------------------------
# Assumptions and disclosure
# ---------------------------------------------------------------------------


def test_disclosure_covers_assumptions_tax_and_uncertainty():
    plan = _plan()
    assert plan.disclosure == GOAL_DISCLOSURE
    text = plan.disclosure.lower()
    assert "illustrative" in text
    assert "before tax" in text
    assert "results will differ" in text
    assert "lose value" in text


def test_assumptions_state_the_rates_and_conventions_used():
    text = " ".join(_plan(savings=300_000).assumptions)
    assert "6% a year" in text  # inflation
    assert "6.5% a year before tax" in text  # the short-term rate
    assert "low risk" in text
    assert "₹3,00,000" in text and "no growth" in text  # face value
    assert "end of each month" in text
    assert "nearest ₹100" in text


def test_assumptions_skip_investment_lines_when_nothing_is_needed():
    text = " ".join(_plan(savings=900_000).assumptions)
    assert "before tax" not in text
    assert "no growth" in text

"""Month-based goal maths in recommendations/wealth.py."""

from datetime import date

import pytest

from app.modules.recommendations import wealth

# ---------------------------------------------------------------------------
# Months until a target date
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("today", "target", "months"),
    [
        (date(2026, 10, 9), date(2027, 4, 15), 6),
        (date(2026, 10, 31), date(2026, 11, 1), 1),  # next calendar month, however few days away
        (date(2026, 10, 1), date(2026, 10, 31), 0),  # same month
        (date(2026, 10, 9), date(2026, 9, 30), -1),  # in the past
        (date(2026, 10, 9), date(2066, 10, 9), 480),
    ],
)
def test_months_until_counts_calendar_months(today, target, months):
    assert wealth.months_until(target, today) == months


@pytest.mark.parametrize(("months", "valid"), [(-1, False), (0, False), (1, True), (480, True), (481, False)])
def test_goal_horizon_limits(months, valid):
    assert wealth.is_valid_goal_horizon(months) is valid


# ---------------------------------------------------------------------------
# Investment approach by horizon
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("months", "key", "rate"),
    [
        (1, "short_term", wealth.SAFE_RATE),
        (35, "short_term", wealth.SAFE_RATE),
        (36, "medium_term", wealth.BALANCED_RATE),
        (60, "medium_term", wealth.BALANCED_RATE),
        (61, "long_term", wealth.GROWTH_RATE),
        (480, "long_term", wealth.GROWTH_RATE),
    ],
)
def test_investment_approach_boundaries(months, key, rate):
    approach = wealth.investment_approach(months)
    assert approach.key == key
    assert approach.annual_rate == rate


def test_investment_approach_rejects_no_time_left():
    for months in (0, -3):
        with pytest.raises(ValueError):
            wealth.investment_approach(months)


def test_investment_approaches_are_ordered_and_open_ended():
    bounds = [a.max_months for a in wealth.INVESTMENT_APPROACHES]
    assert bounds[-1] is None
    assert bounds[:-1] == sorted(bounds[:-1])
    # Safer, shorter goals never assume a higher return than longer ones.
    rates = [a.annual_rate for a in wealth.INVESTMENT_APPROACHES]
    assert rates == sorted(rates)


def test_investment_approach_accepts_other_assumptions():
    custom = (
        wealth.InvestmentApproach("cash", "Cash", 12, 0.0, "low", "Savings account"),
        wealth.InvestmentApproach("rest", "Later", None, 0.07, "medium", "Anything"),
    )
    assert wealth.investment_approach(12, custom).key == "cash"
    assert wealth.investment_approach(13, custom).key == "rest"


# ---------------------------------------------------------------------------
# Future value of existing savings and of monthly contributions
# ---------------------------------------------------------------------------


def test_existing_savings_growth():
    assert wealth.fv_lump_sum_months(100_000, 0.065, 0) == 100_000
    assert wealth.fv_lump_sum_months(100_000, 0.065, 1) == pytest.approx(100_541.67, abs=0.01)
    assert wealth.fv_lump_sum_months(300_000, 0.065, 6) == pytest.approx(309_882.99, abs=0.01)
    # Twelve monthly compoundings beat one yearly one at the same nominal rate.
    assert wealth.fv_lump_sum_months(100_000, 0.06, 12) > wealth.grow(100_000, 0.06, 1)


def test_inflated_cost_compounds_yearly_over_fractional_years():
    assert wealth.inflated_cost_months(800_000, 0.06, 0) == 800_000
    assert wealth.inflated_cost_months(800_000, 0.06, 6) == pytest.approx(823_650.41, abs=0.01)
    assert wealth.inflated_cost_months(100_000, 0.06, 120) == pytest.approx(100_000 * 1.06**10)
    assert wealth.inflated_cost_months(100_000, 0, 60) == 100_000
    with pytest.raises(ValueError):
        wealth.inflated_cost_months(100_000, 0.06, -1)


def test_monthly_contributions_one_and_many_months():
    # One contribution at the end of the only month earns nothing.
    assert wealth.fv_sip_months(10_000, 0.065, 1) == pytest.approx(10_000)
    # Six end-of-month contributions: the first earns 5 months, the last none.
    by_hand = sum(1_000 * (1 + 0.065 / 12) ** k for k in range(6))
    assert wealth.fv_sip_months(1_000, 0.065, 6) == pytest.approx(by_hand)
    assert wealth.fv_sip_months(1_000, 0.065, 0) == 0


def test_zero_interest_rate_is_plain_arithmetic():
    assert wealth.fv_lump_sum_months(50_000, 0, 24) == 50_000
    assert wealth.fv_sip_months(5_000, 0, 24) == 120_000
    assert wealth.monthly_needed_months(120_000, 0, 24) == 5_000
    assert wealth.emi(120_000, 0, 24) == 5_000
    # The year-based helpers no longer divide by zero either.
    assert wealth.sip_value(1_000, 0, 2) == 24_000
    assert wealth.monthly_needed(24_000, 0, 2) == 1_000


# ---------------------------------------------------------------------------
# Required monthly savings
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("months", [1, 6, 36, 120, 480])
@pytest.mark.parametrize("rate", [0, wealth.SAFE_RATE, wealth.GROWTH_RATE])
def test_monthly_needed_months_reverses_future_value(months, rate):
    goal = 824_000
    needed = wealth.monthly_needed_months(goal, rate, months)
    assert wealth.fv_sip_months(needed, rate, months) == pytest.approx(goal)


def test_one_month_goal_needs_the_whole_amount():
    assert wealth.monthly_needed_months(50_000, wealth.SAFE_RATE, 1) == pytest.approx(50_000)


def test_rounded_requirement_always_reaches_the_goal():
    for goal in (514_400, 1_000_000, 2_500_000):
        for months in (1, 6, 18, 60, 240):
            needed = wealth.round_up_to(wealth.monthly_needed_months(goal, wealth.SAFE_RATE, months), 100)
            assert needed % 100 == 0
            # Compared to the paisa: float noise (514399.999999996) isn't a shortfall.
            assert round(wealth.fv_sip_months(needed, wealth.SAFE_RATE, months), 2) >= goal


def test_monthly_needed_months_rejects_bad_input():
    with pytest.raises(ValueError):
        wealth.monthly_needed_months(100_000, 0.065, 0)
    with pytest.raises(ValueError):
        wealth.monthly_needed_months(100_000, 0.065, -2)
    with pytest.raises(ValueError):
        wealth.monthly_needed_months(-1, 0.065, 6)
    with pytest.raises(ValueError):
        wealth.fv_sip_months(1_000, -0.01, 6)
    with pytest.raises(ValueError):
        wealth.fv_lump_sum_months(1_000, 0.065, -1)


# ---------------------------------------------------------------------------
# Rounding up
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("amount", "rounded"),
    [
        (84_501, 84_600),
        (84_500.01, 84_600),
        (84_600, 84_600),
        (84_600.0000001, 84_600),  # float noise doesn't add a step
        (0.01, 100),
        (0, 0),
    ],
)
def test_round_up_to(amount, rounded):
    assert wealth.round_up_to(amount, 100) == rounded


# ---------------------------------------------------------------------------
# Loan EMI
# ---------------------------------------------------------------------------


def test_emi_matches_reference_values():
    # The standard textbook case: 1,00,000 at 10% for 12 months is 8,791.59.
    assert wealth.emi(100_000, 0.10, 12) == pytest.approx(8_791.59, abs=0.01)
    assert wealth.emi(222_000, wealth.LOAN_RATE, 36) == pytest.approx(7_059.54, abs=0.01)


def test_emi_repays_the_loan_exactly():
    principal, rate, months = 500_000, 0.09, 60
    payment = wealth.emi(principal, rate, months)
    balance = principal
    for _ in range(months):
        balance = balance * (1 + rate / 12) - payment
    assert balance == pytest.approx(0, abs=0.01)


def test_emi_rejects_zero_months():
    with pytest.raises(ValueError):
        wealth.emi(100_000, 0.09, 0)


# ---------------------------------------------------------------------------
# Backward compatibility of the year-based helpers
# ---------------------------------------------------------------------------


def _old_sip_value(monthly, annual_rate, years):
    months = years * 12
    if months <= 0:
        return 0
    rate = annual_rate / 12
    return int(monthly * (((1 + rate) ** months - 1) / rate))


def _old_monthly_needed(goal, annual_rate, years):
    months = years * 12
    if months <= 0:
        return int(goal)
    rate = annual_rate / 12
    return int(goal / (((1 + rate) ** months - 1) / rate))


@pytest.mark.parametrize("years", [0, 1, 10, 20, 30, 35])
@pytest.mark.parametrize("rate", [wealth.SAVINGS_ACCOUNT_RATE, wealth.SAFE_RATE, wealth.GROWTH_RATE])
def test_year_helpers_give_the_same_numbers_as_before(years, rate):
    for amount in (500, 10_000, 1_000_000, 37_450_000):
        assert wealth.sip_value(amount, rate, years) == _old_sip_value(amount, rate, years)
        assert wealth.monthly_needed(amount, rate, years) == _old_monthly_needed(amount, rate, years)

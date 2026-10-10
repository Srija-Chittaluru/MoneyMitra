"""Estimated take-home pay in goals/take_home.py."""

from datetime import date

import pytest

from app.modules.goals.take_home import (
    ESTIMATED_PROFESSIONAL_TAX,
    LEFT_OUT_NOTE,
    IncomeEvidence,
    Reliability,
    confirmed_take_home,
    estimate_take_home,
    evidence_from_expected_income,
    evidence_from_itr,
    evidence_from_tax_comparison,
    resolve_take_home,
)
from app.modules.itr import service as itr_service
from app.modules.itr.rules import get_itr_rules
from app.modules.itr.schemas import ItrDraftData
from app.modules.recommendations.context import FinancialContext, RegimeOutcome
from app.modules.tax import service as tax_service
from app.modules.tax.schemas import TaxComparisonInput

TODAY = date(2026, 10, 9)  # FY 2026-27


def _evidence(**overrides) -> IncomeEvidence:
    fields = {
        "source": "tax_comparison",
        "financial_year": "2026-27",
        "annual_gross": 1_800_000,
        "annual_tax": 100_000,
        "annual_professional_tax": None,
    }
    return IncomeEvidence(**(fields | overrides))


# ---------------------------------------------------------------------------
# Estimating from evidence
# ---------------------------------------------------------------------------


def test_current_year_income_gives_an_estimate():
    take_home = estimate_take_home(_evidence(), TODAY)
    assert take_home.reliability == Reliability.ESTIMATED
    assert take_home.is_reliable
    # (18,00,000 - 1,00,000 income tax - 2,500 professional tax) / 12, rounded down.
    assert take_home.monthly == 141_458
    assert take_home.financial_year == "2026-27"
    text = " ".join(take_home.notes)
    assert "tax comparison for FY 2026-27" in text
    assert LEFT_OUT_NOTE in take_home.notes


def test_unknown_professional_tax_is_estimated_and_disclosed_not_zero():
    take_home = estimate_take_home(_evidence(), TODAY)
    assert take_home.annual_professional_tax == ESTIMATED_PROFESSIONAL_TAX
    assert take_home.professional_tax_estimated
    assert any("professional tax is assumed" in note.lower() for note in take_home.notes)


def test_known_professional_tax_is_used():
    take_home = estimate_take_home(_evidence(annual_professional_tax=2_400), TODAY)
    assert take_home.annual_professional_tax == 2_400
    assert not take_home.professional_tax_estimated
    assert take_home.monthly == (1_800_000 - 100_000 - 2_400) // 12


def test_past_year_income_is_stale():
    take_home = estimate_take_home(_evidence(financial_year="2025-26"), TODAY)
    assert take_home.reliability == Reliability.STALE
    assert not take_home.is_reliable
    assert take_home.monthly == 141_458  # still shown, as an indication


def test_expected_income_alone_is_not_reliable():
    take_home = estimate_take_home(_evidence(source="profile"), TODAY)
    assert take_home.reliability == Reliability.EXPECTED_ONLY
    assert not take_home.is_reliable


def test_missing_tax_makes_the_estimate_incomplete():
    take_home = estimate_take_home(_evidence(annual_tax=None), TODAY)
    assert take_home.reliability == Reliability.INCOMPLETE
    assert take_home.monthly is None


def test_tax_at_or_above_income_makes_the_estimate_incomplete():
    take_home = estimate_take_home(_evidence(annual_gross=100_000, annual_tax=100_000), TODAY)
    assert take_home.reliability == Reliability.INCOMPLETE
    assert take_home.monthly is None


def test_confirmed_take_home():
    take_home = confirmed_take_home(95_000)
    assert take_home.reliability == Reliability.CONFIRMED
    assert take_home.is_reliable
    assert take_home.monthly == 95_000
    with pytest.raises(ValueError):
        confirmed_take_home(0)


# ---------------------------------------------------------------------------
# Choosing between sources
# ---------------------------------------------------------------------------


def test_no_source_is_unavailable():
    take_home = resolve_take_home(TODAY)
    assert take_home.reliability == Reliability.UNAVAILABLE
    assert take_home.monthly is None


def test_confirmed_take_home_beats_every_estimate():
    assert resolve_take_home(TODAY, [_evidence()], confirmed_monthly=90_000).monthly == 90_000


def test_current_estimate_beats_stale_and_expected_whatever_the_order():
    stale = _evidence(source="itr_filing", financial_year="2025-26", annual_gross=1_500_000)
    expected = _evidence(source="profile", annual_gross=2_000_000)
    current = _evidence()
    take_home = resolve_take_home(TODAY, [stale, expected, current])
    assert take_home.reliability == Reliability.ESTIMATED
    assert take_home.source == "tax_comparison"


def test_stale_beats_expected_income():
    stale = _evidence(source="itr_filing", financial_year="2025-26")
    expected = _evidence(source="profile")
    assert resolve_take_home(TODAY, [expected, stale]).reliability == Reliability.STALE


def test_only_incomplete_sources_stay_incomplete():
    assert resolve_take_home(TODAY, [_evidence(annual_tax=None)]).reliability == Reliability.INCOMPLETE


# ---------------------------------------------------------------------------
# Evidence from existing MoneyMitra data
# ---------------------------------------------------------------------------


def _summary(draft: ItrDraftData):
    return itr_service.build_summary(draft, get_itr_rules("2026-27"), TODAY)


def test_evidence_from_itr_uses_the_existing_tax_computation():
    draft = ItrDraftData()
    draft.salary.salary_17_1 = 1_800_000
    draft.salary.perquisites_17_2 = 50_000
    draft.salary.professional_tax = 2_400
    summary = _summary(draft)
    evidence = evidence_from_itr(draft, summary)
    assert evidence.source == "itr_filing"
    assert evidence.financial_year == "2025-26"  # AY 2026-27
    assert evidence.annual_gross == 1_800_000  # cash salary, not perquisites
    assert evidence.annual_tax == summary.selected.gross_tax_liability > 0
    assert evidence.annual_professional_tax == 2_400
    # An ITR for last year is never current.
    assert estimate_take_home(evidence, TODAY).reliability == Reliability.STALE


def test_evidence_from_itr_treats_zero_professional_tax_as_unknown():
    draft = ItrDraftData()
    draft.salary.salary_17_1 = 1_200_000
    evidence = evidence_from_itr(draft, _summary(draft), source="documents")
    assert evidence.source == "documents"
    assert evidence.annual_professional_tax is None


def test_evidence_from_itr_needs_a_salary():
    draft = ItrDraftData()
    assert evidence_from_itr(draft, _summary(draft)) is None


def _comparison_context(regime: RegimeOutcome | None, **overrides) -> FinancialContext:
    fields = {
        "source": "tax_comparison",
        "annual_income": 1_800_000,
        "section_80c_total": 0,
        "section_80ccd_1b": 0,
        "claims_health_self": False,
        "claims_health_parents": None,
        "regime": regime,
        "financial_year": "2026-27",
    }
    return FinancialContext(**(fields | overrides))


def test_evidence_from_tax_comparison_uses_the_cheaper_regime():
    regime = RegimeOutcome(old_tax=180_000, new_tax=120_000, better="new", difference=60_000)
    evidence = evidence_from_tax_comparison(_comparison_context(regime))
    assert evidence.annual_tax == 120_000
    assert evidence.annual_professional_tax is None
    assert evidence.financial_year == "2026-27"
    assert estimate_take_home(evidence, TODAY).reliability == Reliability.ESTIMATED


def test_evidence_from_tax_comparison_without_tax_is_incomplete():
    evidence = evidence_from_tax_comparison(_comparison_context(None))
    assert evidence.annual_tax is None
    assert estimate_take_home(evidence, TODAY).reliability == Reliability.INCOMPLETE


def test_evidence_from_tax_comparison_rejects_other_sources():
    with pytest.raises(ValueError):
        evidence_from_tax_comparison(_comparison_context(None, source="itr_filing"))


def test_evidence_from_expected_income_reuses_the_tax_calculator():
    evidence = evidence_from_expected_income(1_800_000, TODAY)
    result = tax_service.calculate_comparison(TaxComparisonInput(tax_year="2026-27", gross_total_income=1_800_000))
    assert evidence.annual_tax == min(result.old_regime.total_tax_payable, result.new_regime.total_tax_payable)
    assert evidence.source == "profile"
    assert evidence.financial_year == "2026-27"
    assert estimate_take_home(evidence, TODAY).reliability == Reliability.EXPECTED_ONLY


def test_evidence_from_expected_income_without_tax_rules_is_incomplete():
    evidence = evidence_from_expected_income(1_800_000, date(2031, 6, 1))
    assert evidence.annual_tax is None
    assert estimate_take_home(evidence, date(2031, 6, 1)).reliability == Reliability.INCOMPLETE

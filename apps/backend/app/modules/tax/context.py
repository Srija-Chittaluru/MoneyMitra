"""
Shared JSON-context builder for the OpenAI-backed modules (explain.py, chat.py).

Keeping this in one place means both modules always hand the model the exact
same shape of ground-truth numbers for a given comparison.
"""

from app.modules.tax.schemas import TaxComparisonResult


def comparison_context(comparison: TaxComparisonResult) -> dict:
    return {
        "tax_year": comparison.tax_year,
        "recommended_regime": comparison.recommended_regime,
        "difference": comparison.difference,
        "old_regime": comparison.old_regime.model_dump(),
        "new_regime": comparison.new_regime.model_dump(),
        "deduction_checklist": [item.model_dump() for item in comparison.deduction_checklist],
    }

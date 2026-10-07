from datetime import date

from sqlalchemy.orm import Session

from app.modules.dashboard.schemas import DashboardSummary, EstimatedTax, RegimeSummary
from app.modules.recommendations.context import load_latest_financial_context
from app.modules.users.models import User


def get_summary(db: Session, user: User, today: date | None = None) -> DashboardSummary:
    """Reuses the financial context the recommendations module already derives;
    no tax rules live here."""
    latest = load_latest_financial_context(db, user, today or date.today())
    if latest is None:
        return DashboardSummary(source=None, annual_income=None, estimated_tax=None, regime=None, updated_at=None)

    updated_at, context = latest
    regime = context.regime
    estimated_tax = None
    if regime is not None:
        better = "old" if regime.better == "old" else "new"  # equal under both: either is the same figure
        estimated_tax = EstimatedTax(regime=better, amount=regime.old_tax if better == "old" else regime.new_tax)
    elif context.selected_tax is not None:
        estimated_tax = EstimatedTax(regime=context.selected_tax.regime, amount=context.selected_tax.tax)

    # An ITR with income but no old-vs-new comparison means the old regime is closed to it.
    old_regime_closed = context.source == "itr_filing" and regime is None and context.selected_tax is not None

    return DashboardSummary(
        source=context.source,
        annual_income=context.annual_income,
        estimated_tax=estimated_tax,
        regime=RegimeSummary(
            old_tax=regime.old_tax,
            new_tax=regime.new_tax,
            better=regime.better,
            difference=regime.difference,
        )
        if regime
        else None,
        regime_unavailable_reason="old_regime_closed" if old_regime_closed else None,
        updated_at=updated_at,
    )

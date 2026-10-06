from datetime import date

from app.modules.resources.content import DEDUCTION_LIMITS, GOVERNMENT_ALERTS
from app.modules.resources.schemas import DeductionLimitOut, GovernmentAlertOut, ResourcesOut


def get_resources(today: date | None = None) -> ResourcesOut:
    today = today or date.today()
    upcoming = sorted((alert for alert in GOVERNMENT_ALERTS if alert.date >= today), key=lambda a: a.date)

    return ResourcesOut(
        alerts=[
            GovernmentAlertOut(
                title=a.title,
                date=a.date,
                description=a.description,
                category=a.category.value,
                source=a.source,
            )
            for a in upcoming
        ],
        deduction_limits=[
            DeductionLimitOut(
                section=limit.section.value,
                label=limit.label,
                limit_general=limit.limit_general,
                limit_senior=limit.limit_senior,
            )
            for limit in DEDUCTION_LIMITS
        ],
    )

from app.modules.recommendations.facts import Facts
from app.modules.recommendations.rules import RULES
from app.modules.recommendations.schemas import NextStep, Recommendation


def run(facts: Facts) -> list[Recommendation]:
    """Runs every rule, in registry order (tax-saving first, then life-stage)."""
    if facts.age is None:
        return []
    return [rec for rule in RULES for rec in rule(facts)]


def next_step(facts: Facts) -> NextStep | None:
    if facts.age is None:
        return NextStep(
            level=1,
            title="Complete your profile",
            description="Add your date of birth to unlock guidance for your stage of life.",
            action_label="Add date of birth",
            action_href=None,
        )
    if facts.declared is None:
        return NextStep(
            level=2,
            title="Add your income",
            description="Run a tax comparison or start your ITR filing to get advice built on your real numbers.",
            action_label="Compare tax regimes",
            action_href="/tax-comparison",
        )
    return NextStep(
        level=3,
        title="Upload your documents",
        description="Documents like Form 16, AIS and payslips fill in your ITR draft automatically. "
        "Deeper document analysis is coming soon.",
        action_label="Upload documents",
        action_href="/documents",
    )

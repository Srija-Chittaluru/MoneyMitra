"""Everything the rules know about a user, gathered once per request."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.modules.recommendations.context import FinancialContext, load_financial_context
from app.modules.recommendations.document_analysis import DocumentAnalysis, load_document_analysis
from app.modules.recommendations.levels import Level
from app.modules.recommendations.profile import EmployeeCategory
from app.modules.recommendations.stages import LifeStage, calculate_age, resolve_life_stage
from app.modules.users.models import User


@dataclass(frozen=True)
class Facts:
    level: Level
    today: date
    date_of_birth: date | None
    age: int | None
    stage: LifeStage | None
    employee_category: EmployeeCategory | None
    expected_income: int | None
    declared: FinancialContext | None
    documents: DocumentAnalysis


def build_facts(db: Session, user: User, today: date) -> Facts:
    age = calculate_age(user.date_of_birth, today) if user.date_of_birth else None
    declared = load_financial_context(db, user, today)
    documents = load_document_analysis(db, user, today)

    if age is None:
        level = Level.NONE
    elif documents.usable:
        level = Level.DOCUMENTS
    elif declared is None:
        level = Level.PROFILE
    else:
        level = Level.DECLARED

    return Facts(
        level=level,
        today=today,
        date_of_birth=user.date_of_birth,
        age=age,
        stage=resolve_life_stage(age) if age is not None else None,
        employee_category=EmployeeCategory(user.employee_category) if user.employee_category else None,
        expected_income=user.expected_annual_income,
        declared=declared,
        documents=documents,
    )

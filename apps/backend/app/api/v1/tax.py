from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.tax import chat, explain, service, slabs
from app.modules.tax.rules.registry import get_supported_tax_years
from app.modules.tax.rules.types import AgeCategory
from app.modules.tax.schemas import (
    ChatRequest,
    ChatResponse,
    ExplanationRequest,
    ExplanationResult,
    SlabTableOut,
    TaxComparisonInput,
    TaxComparisonResult,
)
from app.modules.users.models import User

router = APIRouter(prefix="/tax", tags=["tax"])


@router.get("/years", response_model=list[str])
def list_supported_tax_years(current_user: User = Depends(get_current_user)) -> list[str]:
    return get_supported_tax_years()


@router.post("/comparison", response_model=TaxComparisonResult)
def compare_tax_regimes(
    payload: TaxComparisonInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaxComparisonResult:
    result = service.calculate_comparison(payload)
    service.save_comparison_snapshot(db, current_user, payload)
    return result


@router.get("/slabs", response_model=SlabTableOut)
def get_slab_table(
    tax_year: str,
    age_category: AgeCategory = AgeCategory.GENERAL,
    current_user: User = Depends(get_current_user),
) -> SlabTableOut:
    return slabs.get_slab_table(tax_year, age_category)


@router.post("/explain", response_model=ExplanationResult)
def explain_tax_comparison(
    payload: ExplanationRequest,
    current_user: User = Depends(get_current_user),
) -> ExplanationResult:
    return explain.generate_explanation(payload.comparison)


@router.post("/chat", response_model=ChatResponse)
def chat_about_tax(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    return chat.generate_reply(payload)

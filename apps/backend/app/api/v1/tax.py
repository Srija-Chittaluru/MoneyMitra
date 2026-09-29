from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.tax import service
from app.modules.tax.rules.registry import get_supported_tax_years
from app.modules.tax.schemas import TaxComparisonInput, TaxComparisonResult
from app.modules.users.models import User

router = APIRouter(prefix="/tax", tags=["tax"])


@router.get("/years", response_model=list[str])
def list_supported_tax_years(current_user: User = Depends(get_current_user)) -> list[str]:
    return get_supported_tax_years()


@router.post("/comparison", response_model=TaxComparisonResult)
def compare_tax_regimes(
    payload: TaxComparisonInput,
    current_user: User = Depends(get_current_user),
) -> TaxComparisonResult:
    return service.calculate_comparison(payload)

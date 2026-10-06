from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.planning import service
from app.modules.planning.schemas import TaxPlanOut
from app.modules.users.models import User

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get("/tax-plan", response_model=TaxPlanOut)
def get_tax_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaxPlanOut:
    return service.get_tax_plan(db, current_user)

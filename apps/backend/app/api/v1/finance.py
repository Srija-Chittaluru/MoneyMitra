from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.finance import service
from app.modules.finance.schemas import FinanceOverview
from app.modules.users.models import User

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/overview", response_model=FinanceOverview)
def get_finance_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FinanceOverview:
    return service.get_overview(db, current_user)

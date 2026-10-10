from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.deposits import service
from app.modules.deposits.schemas import RdRatesOut
from app.modules.users.models import User

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.get("/rd-rates", response_model=RdRatesOut)
def get_rd_rates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RdRatesOut:
    return service.get_rd_rates(db, current_user)

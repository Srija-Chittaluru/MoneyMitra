from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.funds import etfs, service
from app.modules.funds.schemas import EtfsOut, MutualFundsOut
from app.modules.users.models import User

router = APIRouter(prefix="/funds", tags=["funds"])


@router.get("/mutual-funds", response_model=MutualFundsOut)
def get_mutual_funds(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MutualFundsOut:
    return service.get_mutual_funds(db, current_user)


@router.get("/etfs", response_model=EtfsOut)
def get_etfs(current_user: User = Depends(get_current_user)) -> EtfsOut:
    return etfs.get_etfs(current_user)

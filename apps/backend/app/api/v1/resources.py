from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user
from app.modules.resources import service
from app.modules.resources.schemas import ResourcesOut
from app.modules.users.models import User

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=ResourcesOut)
def get_resources(current_user: User = Depends(get_current_user)) -> ResourcesOut:
    return service.get_resources()

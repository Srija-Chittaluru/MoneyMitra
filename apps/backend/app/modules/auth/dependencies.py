from fastapi import Depends, HTTPException, status

from app.core.guardrails import enforce
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.security import decode_access_token
from app.modules.auth.service import get_user_by_id
from app.modules.users.models import User

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    user_id = decode_access_token(credentials.credentials)
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    return user


def rate_limited_user(scope: str):
    """Like get_current_user, but also applies the per-user rate limit for `scope`."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        enforce(scope, str(current_user.id))
        return current_user

    return dependency

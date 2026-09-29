from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.schemas import HealthResponse
from app.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database_status = "ok"
    except SQLAlchemyError:
        database_status = "unreachable"

    return HealthResponse(status="ok", database=database_status)

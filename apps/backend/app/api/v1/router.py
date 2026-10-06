from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.documents import router as documents_router
from app.api.v1.health import router as health_router
from app.api.v1.itr import router as itr_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.tax import router as tax_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(tax_router)
api_router.include_router(itr_router)
api_router.include_router(documents_router)
api_router.include_router(recommendations_router)

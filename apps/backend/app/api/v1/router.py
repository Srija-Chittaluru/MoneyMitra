from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.documents import router as documents_router
from app.api.v1.finance import router as finance_router
from app.api.v1.health import router as health_router
from app.api.v1.itr import router as itr_router
from app.api.v1.planning import router as planning_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.resources import router as resources_router
from app.api.v1.tax import router as tax_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(tax_router)
api_router.include_router(itr_router)
api_router.include_router(documents_router)
api_router.include_router(recommendations_router)
api_router.include_router(planning_router)
api_router.include_router(resources_router)
api_router.include_router(users_router)
api_router.include_router(dashboard_router)
api_router.include_router(finance_router)

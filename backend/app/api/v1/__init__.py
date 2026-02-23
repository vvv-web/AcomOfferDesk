from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.offers import router as offers_router
from app.api.v1.requests import router as requests_router
from app.api.v1.tg import router as tg_router
from app.api.v1.feedback import router as feedback_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router, tags=["auth"])
router.include_router(users_router, tags=["users"])
router.include_router(requests_router, tags=["requests"])
router.include_router(offers_router, tags=["offers"])
router.include_router(tg_router, tags=["tg"])
router.include_router(feedback_router, tags=["feedback"])
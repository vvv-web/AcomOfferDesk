from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1 import router as v1_router
from app.domain.exceptions import Conflict, Forbidden, NotFound, Unauthorized

app = FastAPI(title="Order Backend", version="0.1.0")

cors_allow_origins = settings.resolved_cors_allow_origins
if cors_allow_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
app.include_router(v1_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(NotFound)
async def not_found_handler(request: Request, exc: NotFound) -> JSONResponse:
    _ = request
    return JSONResponse(status_code=404, content={"detail": str(exc) or "Not found"})


@app.exception_handler(Forbidden)
async def forbidden_handler(request: Request, exc: Forbidden) -> JSONResponse:
    _ = request
    return JSONResponse(status_code=403, content={"detail": str(exc) or "Forbidden"})


@app.exception_handler(Unauthorized)
async def unauthorized_handler(request: Request, exc: Unauthorized) -> JSONResponse:
    _ = request
    return JSONResponse(status_code=401, content={"detail": str(exc) or "Unauthorized"})


@app.exception_handler(Conflict)
async def conflict_handler(request: Request, exc: Conflict) -> JSONResponse:
    _ = request
    return JSONResponse(status_code=409, content={"detail": str(exc) or "Conflict"})

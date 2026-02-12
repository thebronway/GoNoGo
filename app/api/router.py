from fastapi import APIRouter
from app.api.endpoints import analysis, admin, report, kiosk, calculator, contact

router = APIRouter()

# /api/analyze
router.include_router(analysis.router, prefix="/api", tags=["analysis"])

# /api/report
router.include_router(report.router, prefix="/api", tags=["report"])

# /api/admin/*
router.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# /api/kiosk/*
router.include_router(kiosk.router, prefix="/api/kiosk", tags=["kiosk"])

# /api/logs, /api/stats (Legacy paths used by frontend)
router.include_router(admin.router, prefix="/api", tags=["stats"])

# /api/calculator
router.include_router(calculator.router, prefix="/api/calculator", tags=["calculator"])

# /api/contact
router.include_router(contact.router, prefix="/api/contact", tags=["contact"])
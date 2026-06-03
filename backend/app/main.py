import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR / 'app' / '.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .db import init_db, get_db, force_mock_db, is_using_mock_db, seed_db
from .scheduler import start_scheduler, shutdown_scheduler

# ── Admin route modules ──
from .admin.routes import settings as settings_router
from .admin.routes import staff as staff_router
from .admin.routes import audit as audit_router
from .admin.routes import menu as admin_menu_router
from .admin.routes import orders as admin_orders_router
from .admin.routes import tables as tables_router
from .admin.routes import inventory as inventory_router
from .admin.routes import customers as customers_router
from .admin.routes import offers as admin_offers_router
from .admin.routes import notifications as admin_notif_router
from .admin.routes import billing as billing_router
from .admin.routes import analytics as analytics_router
from .admin.routes import recipes as recipes_router
from .admin.routes import catalog as catalog_router
from .admin.routes import workflow as workflow_router

# ── Client route modules ──
from .client.routes import auth as client_auth_router
from .client.routes import menu as client_menu_router
from .client.routes import orders as client_orders_router
from .client.routes import reservations as client_reservations_router
from .client.routes import queue as client_queue_router
from .client.routes import offers as client_offers_router
from .client.routes import notifications as client_notif_router
from .client.routes import feedback as client_feedback_router
from .client.routes import chat as client_chat_router
from .client.routes import health as client_health_router
from .client.routes import stats as client_stats_router

app = FastAPI(title='RMS Full Stack App')


def _env_truthy(name: str, default: str = 'false') -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in {'1', 'true', 'yes', 'on'}

# ── CORS ──
cors_env = os.getenv('CORS_ORIGINS', '*')
origins = [o.strip() for o in cors_env.split(',') if o.strip()]
allow_all = '*' in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Lifecycle --
@app.on_event('startup')
async def startup():
    db_ready = False
    try:
        init_db()
        database = get_db()
        await database.command('ping')
        print("[Startup] MongoDB connected successfully")
        db_ready = True
    except Exception as e:
        print(f"[Startup] MongoDB connection warning: {e}")

        # Local/dev resilience: optionally fall back to in-memory MongoMock
        if _env_truthy('MONGODB_AUTO_FALLBACK_TO_MOCK', 'true') and not is_using_mock_db():
            if force_mock_db():
                db_ready = True
                print("[Startup] Falling back to MongoMock for local runtime")
            else:
                print("[Startup] MongoMock fallback unavailable")

    if db_ready:
        await seed_db()
        await start_scheduler()
    else:
        print("[Startup] Scheduler and Seeding skipped because database is unavailable")

@app.on_event('shutdown')
async def shutdown():
    shutdown_scheduler()

# -- ADMIN ROUTES --
app.include_router(settings_router.router,     prefix='/api/admin/settings')
app.include_router(staff_router.router,        prefix='/api/admin/staff')
app.include_router(audit_router.router,        prefix='/api/admin/audit')
app.include_router(catalog_router.router,      prefix='/api/admin/catalog')
app.include_router(admin_menu_router.router,   prefix='/api/admin/menu')
app.include_router(admin_orders_router.router, prefix='/api/admin/orders')
app.include_router(tables_router.router,       prefix='/api/admin/tables')
app.include_router(inventory_router.router,    prefix='/api/admin/inventory')
app.include_router(recipes_router.router,      prefix='/api/admin/recipes')
app.include_router(customers_router.router,    prefix='/api/admin/customers')
app.include_router(admin_offers_router.router, prefix='/api/admin/offers')
app.include_router(admin_notif_router.router,  prefix='/api/admin/notifications')
app.include_router(billing_router.router,      prefix='/api/admin/billing')
app.include_router(analytics_router.router,    prefix='/api/admin/analytics')
app.include_router(workflow_router.router,     prefix='/api/admin/workflow')

# -- CLIENT ROUTES --
app.include_router(client_auth_router.router,         prefix='/api/client')
app.include_router(client_menu_router.router,         prefix='/api/client')
app.include_router(client_orders_router.router,       prefix='/api/client')
app.include_router(client_reservations_router.router, prefix='/api/client')
app.include_router(client_queue_router.router,        prefix='/api/client')
app.include_router(client_offers_router.router,       prefix='/api/client')
app.include_router(client_notif_router.router,        prefix='/api/client')
app.include_router(client_feedback_router.router,     prefix='/api/client')
app.include_router(client_chat_router.router,         prefix='/api/client')
app.include_router(client_health_router.router,       prefix='/api/client')
app.include_router(client_stats_router.router,        prefix='/api/client')

# -- HEALTH API --
@app.get('/api/health')
async def health_check():
    return {"status": "healthy"}

# ============================================================
# FRONTEND SERVING
# ============================================================

# Correct path for Render
frontend_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../frontend/dist")
)

print(f"[Startup] Frontend path: {frontend_path}")

# Serve static assets when frontend build exists
frontend_assets_path = os.path.join(frontend_path, "assets")
if os.path.isdir(frontend_assets_path):
    app.mount(
        "/assets",
        StaticFiles(directory=frontend_assets_path),
        name="assets"
    )
else:
    print(f"[Startup] Frontend assets not found at: {frontend_assets_path}")

# Serve React app (ALL routes)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "Frontend not found. Check build path."}

# -- RUN --
if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=10000)

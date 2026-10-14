from sqlalchemy import text
from app_backend.db import db
from app_backend.es_client import es_client

def get_health_status():
    db_status = "disconnected"
    try:
        db.session.execute(text('SELECT 1'))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    es_status = "connected" if es_client.is_available() else "disconnected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "elasticsearch": es_status
    }

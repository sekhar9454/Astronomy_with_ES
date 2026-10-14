from flask import Blueprint
from app_backend.routes.health_routes import health_bp
from app_backend.routes.search_routes import search_bp
from app_backend.routes.document_routes import document_bp
from app_backend.routes.planet_routes import planet_bp

api_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')
api_bp.register_blueprint(health_bp)
api_bp.register_blueprint(search_bp)
api_bp.register_blueprint(document_bp)
api_bp.register_blueprint(planet_bp)

def register_routes(app):
    app.register_blueprint(api_bp)

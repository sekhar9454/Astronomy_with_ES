import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from app_backend.config import Config
from app_backend.db import db
from app_backend.routes import register_routes
from app_backend.es_client import es_client

logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize CORS
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})

    # Initialize Database
    db.init_app(app)

    # Register Blueprints
    register_routes(app)

    # Return JSON (not HTML error pages) for API errors
    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        if not request.path.startswith('/api/'):
            return err
        return jsonify({"error": err.description}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify({"error": "Internal server error"}), 500

    # Ensure indices exist if ES is online
    with app.app_context():
        if es_client.is_available():
            es_client.init_indices()

    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=Config.PORT, debug=False)

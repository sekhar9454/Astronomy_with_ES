from flask import Flask
from flask_cors import CORS
from app_backend.config import Config
from app_backend.db import db
from app_backend.routes import register_routes
from app_backend.es_client import es_client

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize Database
    db.init_app(app)

    # Register Blueprints
    register_routes(app)

    # Ensure indices exist if ES is online
    with app.app_context():
        if es_client.is_available():
            es_client.init_indices()

    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=Config.PORT, debug=False)

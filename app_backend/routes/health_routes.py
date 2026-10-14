from flask import Blueprint, jsonify
from app_backend.controllers import health_controller

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    status = health_controller.get_health_status()
    status_code = 200 if status["database"] == "connected" else 500
    return jsonify(status), status_code

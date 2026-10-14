from flask import Blueprint, request, jsonify
from app_backend.controllers.planet_controller import PlanetService, PlanetServiceError

planet_bp = Blueprint('planets', __name__)

@planet_bp.route('/planets', methods=['POST'])
def create_planet_endpoint():
    raw_payload = request.get_json(silent=True) or {}
    try:
        response_data, status_code = PlanetService.create_planet(raw_payload)
        return jsonify(response_data), status_code
    except PlanetServiceError as err:
        error_response = {
            "status": "error",
            "error_code": err.error_code,
            "message": err.message,
            "details": err.details
        }
        return jsonify(error_response), err.status_code
    except Exception as exc:
        error_response = {
            "status": "error",
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred while processing the request.",
            "details": str(exc)
        }
        return jsonify(error_response), 500

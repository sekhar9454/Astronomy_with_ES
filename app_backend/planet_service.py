import json
import logging
from html import escape
from datetime import datetime
from app_backend.db import db
from app_backend.models import Planet, OutboxEvent
from app_backend.es_client import es_client

logger = logging.getLogger(__name__)

class PlanetServiceError(Exception):
    def __init__(self, message, error_code="INVALID_INPUT", status_code=400, details=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}

class PlanetService:
    @staticmethod
    def validate_and_sanitize_payload(data):
        if not isinstance(data, dict):
            raise PlanetServiceError("Request body must be a JSON object", "INVALID_PAYLOAD", 400)

        errors = {}

        # 1. Validate & Sanitize 'name'
        raw_name = data.get('name')
        if not raw_name or not str(raw_name).strip():
            errors['name'] = "Field 'name' is required and cannot be empty."
        else:
            name = escape(str(raw_name).strip())
            if len(name) > 255:
                errors['name'] = "Field 'name' must not exceed 255 characters."
        
        # 2. Validate & Sanitize 'planet_type'
        raw_type = data.get('planet_type')
        if not raw_type or not str(raw_type).strip():
            errors['planet_type'] = "Field 'planet_type' is required."
        else:
            planet_type = escape(str(raw_type).strip())
            if len(planet_type) > 100:
                errors['planet_type'] = "Field 'planet_type' must not exceed 100 characters."

        # 3. Validate & Sanitize 'description'
        raw_desc = data.get('description')
        if not raw_desc or not str(raw_desc).strip():
            errors['description'] = "Field 'description' is required."
        else:
            description = escape(str(raw_desc).strip())

        # 4. Optional 'discovery_year'
        discovery_year = data.get('discovery_year')
        if discovery_year is not None:
            try:
                discovery_year = int(discovery_year)
                if discovery_year < -5000 or discovery_year > 2100:
                    errors['discovery_year'] = "Discovery year must be between -5000 and 2100."
            except (ValueError, TypeError):
                errors['discovery_year'] = "Field 'discovery_year' must be an integer."

        # 5. Optional 'atmosphere_summary'
        raw_atmo = data.get('atmosphere_summary')
        atmosphere_summary = escape(str(raw_atmo).strip()) if raw_atmo and str(raw_atmo).strip() else None

        if errors:
            raise PlanetServiceError(
                message="Validation failed for request payload.",
                error_code="VALIDATION_FAILED",
                status_code=400,
                details=errors
            )

        return {
            'name': name,
            'planet_type': planet_type,
            'description': description,
            'discovery_year': discovery_year,
            'atmosphere_summary': atmosphere_summary
        }

    @classmethod
    def create_planet(cls, raw_data):
        # Step 1: Validate and sanitize input payload
        clean_data = cls.validate_and_sanitize_payload(raw_data)

        # Step 2: Idempotency / Duplicate Check on unique planet name
        existing_planet = Planet.query.filter(
            db.func.lower(Planet.name) == clean_data['name'].lower()
        ).first()

        if existing_planet:
            raise PlanetServiceError(
                message=f"Planet with name '{clean_data['name']}' already exists.",
                error_code="RESOURCE_ALREADY_EXISTS",
                status_code=409,
                details={"existing_id": existing_planet.id, "name": existing_planet.name}
            )

        # Step 3: Transactional Primary Database Insert
        try:
            planet = Planet(
                name=clean_data['name'],
                planet_type=clean_data['planet_type'],
                description=clean_data['description'],
                discovery_year=clean_data['discovery_year'],
                atmosphere_summary=clean_data['atmosphere_summary']
            )
            db.session.add(planet)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"PostgreSQL insertion error: {e}")
            raise PlanetServiceError(
                message="Failed to insert planet record into primary database.",
                error_code="DATABASE_ERROR",
                status_code=500
            )

        # Step 4: Indexing into Elasticsearch with Outbox Fallback Strategy
        es_indexed = False
        try:
            es_indexed = es_client.index_planet_document(planet)
        except Exception as e:
            logger.error(f"Elasticsearch exception during planet index: {e}")
            es_indexed = False

        if not es_indexed:
            # Outbox Fallback: Store an OutboxEvent in PostgreSQL for background reconciliation
            logger.warning(f"Elasticsearch indexing failed/unavailable for planet ID {planet.id}. Creating OutboxEvent.")
            try:
                outbox_event = OutboxEvent(
                    aggregate_type='planet',
                    aggregate_id=str(planet.id),
                    event_type='PLANET_CREATED',
                    payload=json.dumps(planet.to_dict()),
                    status='PENDING'
                )
                db.session.add(outbox_event)
                db.session.commit()
            except Exception as outbox_err:
                logger.error(f"Failed to record OutboxEvent: {outbox_err}")

        response_payload = {
            "status": "success",
            "message": "Planet record created successfully.",
            "data": {
                "planet": planet.to_dict(),
                "sync_metadata": {
                    "elasticsearch_indexed": es_indexed,
                    "consistency_mode": "SYNCHRONOUS" if es_indexed else "EVENTUAL_OUTBOX"
                }
            }
        }

        return response_payload, 201

from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import text, extract
from app_backend.db import db
from app_backend.models import ApodDocument, Planet
from app_backend.es_client import es_client

api_bp = Blueprint('api_v1', __name__, url_prefix='/api/v1')

@api_bp.route('/health', methods=['GET'])
def health_check():
    db_status = "disconnected"
    try:
        db.session.execute(text('SELECT 1'))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    es_status = "connected" if es_client.is_available() else "disconnected"

    status_code = 200 if db_status == "connected" else 500
    return jsonify({
        "status": "ok" if status_code == 200 else "degraded",
        "database": db_status,
        "elasticsearch": es_status
    }), status_code

@api_bp.route('/regular_search', methods=['GET'])
def regular_search():
    query = request.args.get('search_query', '').strip()
    skip = request.args.get('skip', 0, type=int)
    limit = request.args.get('limit', 10, type=int)
    year = request.args.get('year', None)
    tokenizer = request.args.get('tokenizer', 'standard').strip()

    # Unless user enters a search query, return empty results
    if not query:
        return jsonify({"total": 0, "max_pages": 1, "hits": [], "documents": []}), 200

    # Try Elasticsearch first
    es_result = es_client.search_regular(query=query, skip=skip, limit=limit, year=year, tokenizer=tokenizer)
    if es_result is not None:
        return jsonify(es_result), 200

    # Fallback to Neon PostgreSQL query
    pattern = f"%{query}%"
    q_apod = db.session.query(ApodDocument).filter((ApodDocument.title.ilike(pattern)) | (ApodDocument.explanation.ilike(pattern)))
    q_planet = db.session.query(Planet).filter((Planet.name.ilike(pattern)) | (Planet.description.ilike(pattern)) | (Planet.atmosphere_summary.ilike(pattern)))

    if year and str(year).isdigit():
        q_apod = q_apod.filter(extract('year', ApodDocument.date) == int(year))
        q_planet = q_planet.filter(Planet.discovery_year == int(year))

    docs_apod = [d.to_dict() for d in q_apod.order_by(ApodDocument.date.desc()).offset(skip).limit(limit).all()]
    planets = q_planet.offset(skip).limit(limit).all()
    
    docs_planet = []
    for p in planets:
        docs_planet.append({
            'id': p.id,
            'title': p.name,
            'explanation': p.description + (f" | Atmosphere: {p.atmosphere_summary}" if p.atmosphere_summary else ""),
            'authors': p.planet_type + (f" (Discovered {p.discovery_year})" if p.discovery_year else ""),
            'date': p.created_at.strftime('%Y-%m-%d') if p.created_at else str(p.discovery_year or ''),
            'image_url': 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=800&auto=format&fit=crop'
        })

    all_docs = docs_planet + docs_apod
    
    # Deduplicate by title and date
    seen = set()
    unique_dicts = []
    for d_dict in all_docs:
        key = (d_dict.get('title', '').strip().lower(), str(d_dict.get('date', '')))
        if key not in seen:
            seen.add(key)
            unique_dicts.append(d_dict)

    unique_dicts = unique_dicts[:limit]
    max_pages = max(1, (len(unique_dicts) + limit - 1) // limit)

    return jsonify({
        "total": len(unique_dicts),
        "max_pages": max_pages,
        "hits": unique_dicts,
        "documents": unique_dicts
    }), 200

@api_bp.route('/semantic_search', methods=['GET'])
def semantic_search():
    # Semantic search with graceful fallback to regular search if vector engine offline
    query = request.args.get('search_query', '').strip()
    skip = request.args.get('skip', 0, type=int)
    limit = request.args.get('limit', 10, type=int)
    year = request.args.get('year', None)

    # Fallback to regular search implementation
    return regular_search()

@api_bp.route('/get_docs_per_year_count', methods=['GET'])
def get_docs_per_year_count():
    query = request.args.get('search_query', '').strip()

    # Try Elasticsearch date_histogram
    es_result = es_client.get_docs_per_year_count(query=query)
    if es_result is not None:
        return jsonify({"docs_per_year": es_result, "year_counts": es_result}), 200

    # Fallback to PostgreSQL GROUP BY EXTRACT(YEAR FROM date)
    q = db.session.query(
        extract('year', ApodDocument.date).label('yr'),
        db.func.count(ApodDocument.id).label('cnt')
    )
    if query:
        pattern = f"%{query}%"
        q = q.filter((ApodDocument.title.ilike(pattern)) | (ApodDocument.explanation.ilike(pattern)))
    
    results = q.group_by('yr').all()
    year_counts = {str(int(r.yr)): r.cnt for r in results if r.yr is not None}

    return jsonify({"docs_per_year": year_counts, "year_counts": year_counts}), 200

@api_bp.route('/documents', methods=['GET'])
def get_documents():
    skip = request.args.get('skip', 0, type=int)
    limit = request.args.get('limit', 20, type=int)
    year = request.args.get('year', None)

    q = db.session.query(ApodDocument)
    if year and year.isdigit():
        q = q.filter(extract('year', ApodDocument.date) == int(year))

    total = q.count()
    docs = q.order_by(ApodDocument.date.desc()).offset(skip).limit(limit).all()

    return jsonify({
        "total": total,
        "documents": [d.to_dict() for d in docs]
    }), 200

@api_bp.route('/documents', methods=['POST'])
def create_document():
    data = request.get_json() or {}
    
    required_fields = ['date', 'title', 'explanation']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        doc_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Expected YYYY-MM-DD"}), 400

    existing = ApodDocument.query.filter_by(date=doc_date).first()
    if existing:
        return jsonify({"error": f"Document for date {doc_date} already exists"}), 409

    doc = ApodDocument(
        date=doc_date,
        title=data['title'],
        explanation=data['explanation'],
        image_url=data.get('image_url'),
        authors=data.get('authors')
    )

    db.session.add(doc)
    db.session.commit()

    # Sync to Elasticsearch
    if es_client.is_available():
        es_client.bulk_index_documents([doc])

    return jsonify({
        "message": "Document created successfully",
        "document": doc.to_dict()
    }), 201

@api_bp.route('/documents/<int:doc_id>', methods=['GET'])
def get_document_by_id(doc_id):
    doc = ApodDocument.query.get_or_404(doc_id)
    return jsonify(doc.to_dict()), 200

@api_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
def delete_document_endpoint(doc_id):
    doc = ApodDocument.query.get_or_404(doc_id)

    # 1. Delete from Elasticsearch across indices
    if es_client.is_available():
        es_client.delete_document(doc_id, date=doc.date)

    # 2. Delete from Database
    db.session.delete(doc)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Document {doc_id} deleted from database and search index."
    }), 200

@api_bp.route('/sync_db_to_es', methods=['POST'])
def sync_db_to_es():
    if not es_client.is_available():
        return jsonify({"error": "Elasticsearch service is unavailable"}), 503

    docs = ApodDocument.query.all()
    es_client.init_indices()
    success = es_client.bulk_index_documents(docs)

    if success:
        return jsonify({"message": "Successfully synchronized database to Elasticsearch", "total_indexed": len(docs)}), 200
    else:
        return jsonify({"error": "Failed to index documents into Elasticsearch"}), 500

from app_backend.planet_service import PlanetService, PlanetServiceError

@api_bp.route('/planets', methods=['POST'])
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

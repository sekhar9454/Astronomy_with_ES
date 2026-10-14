from datetime import datetime
from sqlalchemy import extract
from app_backend.db import db
from app_backend.models import ApodDocument
from app_backend.es_client import es_client
from app_backend.controllers.errors import ServiceError

def list_documents(skip=0, limit=20, year=None):
    q = db.session.query(ApodDocument)
    if year and year.isdigit():
        q = q.filter(extract('year', ApodDocument.date) == int(year))

    total = q.count()
    docs = q.order_by(ApodDocument.date.desc()).offset(skip).limit(limit).all()
    return total, docs

def get_document(doc_id):
    return ApodDocument.query.get_or_404(doc_id)

def create_document(data):
    required_fields = ['date', 'title', 'explanation']
    for field in required_fields:
        if not data.get(field):
            raise ServiceError(f"Field '{field}' is required", status_code=400)

    try:
        doc_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    except ValueError:
        raise ServiceError("Invalid date format. Expected YYYY-MM-DD", status_code=400)

    existing = ApodDocument.query.filter_by(date=doc_date).first()
    if existing:
        raise ServiceError(f"Document for date {doc_date} already exists", error_code="RESOURCE_ALREADY_EXISTS", status_code=409)

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

    return doc

def delete_document(doc_id):
    doc = ApodDocument.query.get_or_404(doc_id)

    # 1. Delete from Elasticsearch across indices
    if es_client.is_available():
        es_client.delete_document(doc_id, date=doc.date)

    # 2. Delete from Database
    db.session.delete(doc)
    db.session.commit()

def sync_db_to_es():
    if not es_client.is_available():
        raise ServiceError("Elasticsearch service is unavailable", error_code="SERVICE_UNAVAILABLE", status_code=503)

    docs = ApodDocument.query.all()
    es_client.init_indices()
    if not es_client.bulk_index_documents(docs):
        raise ServiceError("Failed to index documents into Elasticsearch", error_code="INDEXING_FAILED", status_code=500)

    return len(docs)

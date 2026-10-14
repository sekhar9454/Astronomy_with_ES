from sqlalchemy import extract
from app_backend.db import db
from app_backend.models import ApodDocument, Planet
from app_backend.es_client import es_client

PLANET_IMAGE_URL = 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=800&auto=format&fit=crop'

def _planet_to_search_hit(p):
    return {
        'id': p.id,
        'title': p.name,
        'explanation': p.description + (f" | Atmosphere: {p.atmosphere_summary}" if p.atmosphere_summary else ""),
        'authors': p.planet_type + (f" (Discovered {p.discovery_year})" if p.discovery_year else ""),
        'date': p.created_at.strftime('%Y-%m-%d') if p.created_at else str(p.discovery_year or ''),
        'image_url': PLANET_IMAGE_URL
    }

def regular_search(query, skip=0, limit=10, year=None, tokenizer='standard'):
    # Unless user enters a search query, return empty results
    if not query:
        return {"total": 0, "max_pages": 1, "hits": [], "documents": []}

    # Try Elasticsearch first
    es_result = es_client.search_regular(query=query, skip=skip, limit=limit, year=year, tokenizer=tokenizer)
    if es_result is not None:
        return es_result

    # Fallback to Neon PostgreSQL query
    pattern = f"%{query}%"
    q_apod = db.session.query(ApodDocument).filter((ApodDocument.title.ilike(pattern)) | (ApodDocument.explanation.ilike(pattern)))
    q_planet = db.session.query(Planet).filter((Planet.name.ilike(pattern)) | (Planet.description.ilike(pattern)) | (Planet.atmosphere_summary.ilike(pattern)))

    if year and str(year).isdigit():
        q_apod = q_apod.filter(extract('year', ApodDocument.date) == int(year))
        q_planet = q_planet.filter(Planet.discovery_year == int(year))

    docs_apod = [d.to_dict() for d in q_apod.order_by(ApodDocument.date.desc()).offset(skip).limit(limit).all()]
    docs_planet = [_planet_to_search_hit(p) for p in q_planet.offset(skip).limit(limit).all()]

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

    return {
        "total": len(unique_dicts),
        "max_pages": max_pages,
        "hits": unique_dicts,
        "documents": unique_dicts
    }

def semantic_search(query, skip=0, limit=10, year=None, tokenizer='standard'):
    # Semantic search with graceful fallback to regular search if vector engine offline
    return regular_search(query, skip=skip, limit=limit, year=year, tokenizer=tokenizer)

def get_docs_per_year_count(query=''):
    # Try Elasticsearch date_histogram
    es_result = es_client.get_docs_per_year_count(query=query)
    if es_result is not None:
        return es_result

    # Fallback to PostgreSQL GROUP BY EXTRACT(YEAR FROM date)
    q = db.session.query(
        extract('year', ApodDocument.date).label('yr'),
        db.func.count(ApodDocument.id).label('cnt')
    )
    if query:
        pattern = f"%{query}%"
        q = q.filter((ApodDocument.title.ilike(pattern)) | (ApodDocument.explanation.ilike(pattern)))

    results = q.group_by('yr').all()
    return {str(int(r.yr)): r.cnt for r in results if r.yr is not None}

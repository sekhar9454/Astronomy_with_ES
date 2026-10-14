import os
import pytest
from datetime import date
from app_backend.app import create_app
from app_backend.db import db
from app_backend.models import ApodDocument
from app_backend.es_client import es_client

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()

def test_health_check(client):
    response = client.get('/api/v1/health')
    assert response.status_code in [200, 500]
    data = response.get_json()
    assert 'status' in data
    assert 'database' in data
    assert 'elasticsearch' in data

def test_regular_search(client):
    response = client.get('/api/v1/regular_search?search_query=galaxy&limit=5')
    assert response.status_code == 200
    data = response.get_json()
    assert 'total' in data
    assert 'documents' in data
    assert isinstance(data['documents'], list)

def test_regular_search_n_gram(client):
    response = client.get('/api/v1/regular_search?search_query=star&tokenizer=n_gram&limit=5')
    assert response.status_code == 200
    data = response.get_json()
    assert 'total' in data
    assert 'documents' in data

def test_get_docs_per_year_count(client):
    response = client.get('/api/v1/get_docs_per_year_count?search_query=sun')
    assert response.status_code == 200
    data = response.get_json()
    assert 'year_counts' in data
    assert isinstance(data['year_counts'], dict)

def test_get_documents_pagination(client):
    response = client.get('/api/v1/documents?skip=0&limit=10')
    assert response.status_code == 200
    data = response.get_json()
    assert 'total' in data
    assert len(data['documents']) <= 10

def test_create_document(client):
    test_date = '2099-12-31'
    # Cleanup if exists
    with client.application.app_context():
        ApodDocument.query.filter_by(date=date(2099, 12, 31)).delete()
        db.session.commit()

    payload = {
        'date': test_date,
        'title': 'Test Deep Space Galaxy',
        'explanation': 'A test document created during automated testing.',
        'image_url': 'https://example.com/test.jpg',
        'authors': 'Test Suite Author'
    }
    response = client.post('/api/v1/documents', json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data['document']['title'] == 'Test Deep Space Galaxy'

    # Cleanup after test
    with client.application.app_context():
        ApodDocument.query.filter_by(date=date(2099, 12, 31)).delete()
        db.session.commit()

def test_es_fallback(client, monkeypatch):
    # Mock es_client.is_available to return False to test database fallback
    monkeypatch.setattr(es_client, 'is_available', lambda: False)
    
    response = client.get('/api/v1/regular_search?search_query=nebula&limit=5')
    assert response.status_code == 200
    data = response.get_json()
    assert 'total' in data
    assert 'documents' in data

def test_delete_apod_document_sync(client):
    test_date = '2099-01-01'
    # Cleanup if exists
    with client.application.app_context():
        ApodDocument.query.filter_by(date=date(2099, 1, 1)).delete()
        db.session.commit()

    payload = {
        'date': test_date,
        'title': 'Test Document To Delete',
        'explanation': 'This document will be deleted by automated sync test.',
        'image_url': 'https://example.com/delete.jpg',
        'authors': 'Delete Test Author'
    }
    create_res = client.post('/api/v1/documents', json=payload)
    assert create_res.status_code == 201
    created_doc = create_res.get_json()['document']
    doc_id = created_doc['id']

    # Issue DELETE request
    delete_res = client.delete(f'/api/v1/documents/{doc_id}')
    assert delete_res.status_code == 200
    delete_data = delete_res.get_json()
    assert delete_data['status'] == 'success'
    assert f'Document {doc_id} deleted' in delete_data['message']

    # Assert record no longer exists in DB
    with client.application.app_context():
        assert ApodDocument.query.get(doc_id) is None

    # Assert record no longer returned in ES
    if es_client.is_available():
        es_res = es_client.search_regular(query='Delete Test Author')
        if es_res and 'hits' in es_res:
            hit_ids = [h.get('id') for h in es_res['hits']]
            assert doc_id not in hit_ids


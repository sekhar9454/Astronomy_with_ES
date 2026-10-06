import pytest
from app_backend.app import create_app
from app_backend.db import db
from app_backend.models import Planet, OutboxEvent
from app_backend.es_client import es_client

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            yield client

def test_create_planet_success(client):
    # Cleanup if exists
    with client.application.app_context():
        Planet.query.filter_by(name='Kepler-186f Test').delete()
        db.session.commit()

    payload = {
        'name': 'Kepler-186f Test',
        'discovery_year': 2014,
        'planet_type': 'Exoplanet',
        'description': 'Kepler-186f is an exoplanet orbiting the red dwarf Kepler-186, about 580 light-years from Earth.',
        'atmosphere_summary': 'Potentially nitrogen and carbon dioxide rich atmosphere.'
    }
    response = client.post('/api/v1/planets', json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['data']['planet']['name'] == 'Kepler-186f Test'

    # Cleanup after test
    with client.application.app_context():
        Planet.query.filter_by(name='Kepler-186f Test').delete()
        db.session.commit()

def test_create_planet_validation_failure(client):
    payload = {
        'name': '', # Invalid empty name
        'planet_type': 'Exoplanet',
        'description': 'Short description'
    }
    response = client.post('/api/v1/planets', json=payload)
    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'
    assert data['error_code'] == 'VALIDATION_FAILED'
    assert 'name' in data['details']

def test_create_planet_duplicate_conflict(client):
    with client.application.app_context():
        Planet.query.filter_by(name='Mars Test Unique').delete()
        db.session.commit()

    payload = {
        'name': 'Mars Test Unique',
        'discovery_year': 1610,
        'planet_type': 'Terrestrial',
        'description': 'The Red Planet is the fourth planet from the Sun.'
    }
    res1 = client.post('/api/v1/planets', json=payload)
    assert res1.status_code == 201

    # Duplicate call
    res2 = client.post('/api/v1/planets', json=payload)
    assert res2.status_code == 409
    data = res2.get_json()
    assert data['error_code'] == 'RESOURCE_ALREADY_EXISTS'

    # Cleanup after test
    with client.application.app_context():
        Planet.query.filter_by(name='Mars Test Unique').delete()
        db.session.commit()

def test_create_planet_es_outbox_fallback(client, monkeypatch):
    with client.application.app_context():
        Planet.query.filter_by(name='Proxima Centauri b Test').delete()
        db.session.commit()

    # Mock ES client as unavailable
    monkeypatch.setattr(es_client, 'is_available', lambda: False)

    payload = {
        'name': 'Proxima Centauri b Test',
        'discovery_year': 2016,
        'planet_type': 'Exoplanet',
        'description': 'Proxima Centauri b is an exoplanet orbiting in the habitable zone of the red dwarf star Proxima Centauri.'
    }
    response = client.post('/api/v1/planets', json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data['data']['sync_metadata']['consistency_mode'] == 'EVENTUAL_OUTBOX'

    # Verify OutboxEvent recorded
    with client.application.app_context():
        outbox = OutboxEvent.query.filter_by(event_type='PLANET_CREATED').order_by(OutboxEvent.id.desc()).first()
        assert outbox is not None
        assert 'Proxima Centauri b Test' in outbox.payload

    # Cleanup after test
    with client.application.app_context():
        Planet.query.filter_by(name='Proxima Centauri b Test').delete()
        OutboxEvent.query.filter_by(event_type='PLANET_CREATED').delete()
        db.session.commit()

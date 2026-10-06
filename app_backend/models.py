from datetime import datetime
from app_backend.db import db

class ApodDocument(db.Model):
    __tablename__ = 'apod_documents'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date = db.Column(db.Date, unique=True, nullable=False, index=True)
    year = db.Column(db.Integer, nullable=True, index=True)
    title = db.Column(db.String(500), nullable=False)
    explanation = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(1000), nullable=True)
    authors = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.date and not self.year:
            self.year = self.date.year

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'year': self.year or (self.date.year if self.date else None),
            'title': self.title,
            'explanation': self.explanation,
            'image_url': self.image_url,
            'authors': self.authors,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Planet(db.Model):
    __tablename__ = 'planets'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), unique=True, nullable=False, index=True)
    discovery_year = db.Column(db.Integer, nullable=True, index=True)
    planet_type = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    atmosphere_summary = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'discovery_year': self.discovery_year,
            'planet_type': self.planet_type,
            'description': self.description,
            'atmosphere_summary': self.atmosphere_summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class OutboxEvent(db.Model):
    __tablename__ = 'outbox_events'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    aggregate_type = db.Column(db.String(50), nullable=False, default='planet')
    aggregate_id = db.Column(db.String(100), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    payload = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='PENDING', index=True)
    retry_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

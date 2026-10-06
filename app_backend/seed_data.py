import os
import json
from datetime import datetime
import logging
from app_backend.app import create_app
from app_backend.db import db
from app_backend.models import ApodDocument
from app_backend.es_client import es_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'apod.json')

def seed_database_and_es():
    app = create_app()
    with app.app_context():
        logger.info("Initializing Neon PostgreSQL database tables...")
        db.create_all()

        if not os.path.exists(DATA_FILE_PATH):
            logger.error(f"Data file not found at {DATA_FILE_PATH}")
            return

        logger.info(f"Reading records from {DATA_FILE_PATH}...")
        with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
            records = json.load(f)

        logger.info(f"Loaded {len(records)} items from JSON.")

        # Existing dates map to avoid duplicate key errors
        existing_dates = {d.date for d in ApodDocument.query.with_entities(ApodDocument.date).all()}

        new_documents = []
        for item in records:
            raw_date = item.get('date')
            if not raw_date:
                continue

            try:
                doc_date = datetime.strptime(raw_date, '%Y-%m-%d').date()
            except ValueError:
                continue

            if doc_date in existing_dates:
                continue

            title = item.get('title', 'Untitled APOD').strip()
            explanation = item.get('explanation', '').strip()
            if not title or not explanation:
                continue

            image_url = item.get('hdurl') or item.get('url') or ''
            authors = item.get('copyright') or item.get('author') or ''

            doc = ApodDocument(
                date=doc_date,
                title=title,
                explanation=explanation,
                image_url=image_url[:1000] if image_url else None,
                authors=authors[:500] if authors else None
            )
            new_documents.append(doc)
            existing_dates.add(doc_date)

        if new_documents:
            logger.info(f"Inserting {len(new_documents)} new documents into Neon PostgreSQL...")
            # Batch insertion in chunks
            chunk_size = 500
            for i in range(0, len(new_documents), chunk_size):
                db.session.add_all(new_documents[i:i + chunk_size])
                db.session.commit()
            logger.info("PostgreSQL seeding complete.")
        else:
            logger.info("No new documents to insert into PostgreSQL.")

        # Index into Elasticsearch
        all_docs = ApodDocument.query.all()
        logger.info(f"Total documents in database: {len(all_docs)}")

        if es_client.is_available():
            logger.info("Initializing Elasticsearch indices and bulk indexing...")
            es_client.init_indices()
            success = es_client.bulk_index_documents(all_docs)
            if success:
                logger.info("Elasticsearch bulk indexing completed successfully!")
            else:
                logger.warning("Elasticsearch bulk indexing finished with warnings/errors.")
        else:
            logger.warning("Elasticsearch is currently unavailable. Data is safe in Neon PostgreSQL.")

if __name__ == '__main__':
    seed_database_and_es()

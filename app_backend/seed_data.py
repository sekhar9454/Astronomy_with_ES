import os
import json
import argparse
from datetime import datetime
import logging
from app_backend.app import create_app
from app_backend.db import db
from app_backend.models import ApodDocument
from app_backend.es_client import es_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'apod.json')

def seed_database_and_es(drop_existing=False, recreate_es=True, generate_embeddings=True):
    app = create_app()
    with app.app_context():
        logger.info("Initializing Neon PostgreSQL / SQLite database tables...")
        db.create_all()

        if drop_existing:
            logger.info("Drop requested: Clearing existing ApodDocument records from database...")
            ApodDocument.query.delete()
            db.session.commit()

        if not os.path.exists(DATA_FILE_PATH):
            logger.error(f"Data file not found at {DATA_FILE_PATH}")
            return

        logger.info(f"Reading records from {DATA_FILE_PATH}...")
        with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
            records = json.load(f)

        logger.info(f"Loaded {len(records)} items from JSON.")

        # Existing dates in DB for fast lookup
        existing_dates = {d.date for d in db.session.query(ApodDocument.date).all()}
        
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
            logger.info(f"Inserting {len(new_documents)} new documents into database...")
            chunk_size = 500
            for i in range(0, len(new_documents), chunk_size):
                db.session.add_all(new_documents[i:i + chunk_size])
                db.session.commit()
            logger.info("Database document insertion complete.")

        # Index into Elasticsearch
        all_docs = ApodDocument.query.all()
        logger.info(f"Total documents in database ready for ES indexing: {len(all_docs)}")

        if es_client.is_available():
            if recreate_es:
                logger.info("Flushing and recreating Elasticsearch indices ('apod', 'apod_n_gram', 'apod_embedding')...")
                es_client.recreate_indices()
            else:
                es_client.init_indices()

            logger.info("Bulk indexing documents into Elasticsearch (standard, edge n-gram, and dense vector embeddings)...")
            success = es_client.bulk_index_documents(all_docs, generate_embeddings=generate_embeddings)
            if success:
                logger.info("Elasticsearch re-seeding and indexing completed successfully!")
            else:
                logger.warning("Elasticsearch indexing finished with warnings/errors.")
        else:
            logger.warning("Elasticsearch is currently unavailable. Data is safe in database.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Seed APOD database and Elasticsearch indices.")
    parser.add_argument('--drop', action='store_true', help="Drop existing database records before seeding.")
    parser.add_argument('--no-recreate-es', action='store_true', help="Do not clear Elasticsearch indices before indexing.")
    parser.add_argument('--no-embeddings', action='store_true', help="Skip vector embeddings generation.")
    args = parser.parse_args()

    seed_database_and_es(
        drop_existing=args.drop,
        recreate_es=not args.no_recreate_es,
        generate_embeddings=not args.no_embeddings
    )

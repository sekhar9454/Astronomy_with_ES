import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-secret-key')
    
    # Neon PostgreSQL connection string
    raw_db_url = os.environ.get('DATABASE_URL', '')
    if not raw_db_url:
        # Fallback to local sqlite if not set
        raw_db_url = 'sqlite:///apod.db'
    
    # Ensure SQLAlchemy dialect is specified for psycopg2 if postgresql:// is used
    if raw_db_url.startswith('postgresql://'):
        SQLALCHEMY_DATABASE_URI = raw_db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    else:
        SQLALCHEMY_DATABASE_URI = raw_db_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Check pooled connections before use and recycle them before Neon's idle timeout
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    # Browser origins allowed to call /api/* (comma-separated), e.g. "https://my-app.vercel.app"
    # Quotes, spaces and trailing slashes are stripped: browsers send the origin as scheme://host[:port] only
    CORS_ORIGINS = [o.strip().strip('"\'').strip().rstrip('/')
                    for o in os.environ.get('CORS_ORIGINS', '*').split(',')]
    CORS_ORIGINS = [o for o in CORS_ORIGINS if o] or ['*']

    # Elasticsearch configuration (set ELASTICSEARCH_ENABLED=false to always use the PostgreSQL fallback)
    ELASTICSEARCH_ENABLED = os.environ.get('ELASTICSEARCH_ENABLED', 'true').strip().lower() not in ('0', 'false', 'no', 'off')
    ELASTICSEARCH_NODE = os.environ.get('ELASTICSEARCH_NODE', os.environ.get('ELASTICSEARCH_URL', 'http://localhost:9200'))
    ELASTICSEARCH_API_KEY = os.environ.get('ELASTICSEARCH_API_KEY', '')
    ELASTICSEARCH_USERNAME = os.environ.get('ELASTICSEARCH_USERNAME', os.environ.get('ELASTICSEARCH_USER', ''))
    ELASTICSEARCH_PASSWORD = os.environ.get('ELASTICSEARCH_PASSWORD', '')

    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
    PORT = int(os.environ.get('PORT', 5000))

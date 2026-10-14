# Project Context & Architecture Guide: APOD Astronomy Search Engine

> **Purpose**: This document provides a complete, concise, and structured technical context of the APOD Search Engine project to enable any LLM (or AI assistant) to quickly understand the system architecture, codebase layout, database schemas, API contracts, search flows, and development workflows.

---

## 1. Executive Summary & Technology Stack

The **APOD Astronomy Search Engine** is a full-stack enterprise web application for searching, discovering, and managing NASA's Astronomy Picture of the Day (APOD) records and planetary exploration data.

- **Frontend**: **React.js 18** (Vite, Axios, Lucide React icons, Glassmorphism UI styling, Canvas-based animated starfield).
- **Backend**: **Flask** RESTful API (Flask-CORS, Flask-SQLAlchemy, Blueprints, modular service architecture).
- **Primary Relational DB**: **PostgreSQL** (Hosted serverless on **Neon DB** / `psycopg2-binary`) with automated SQLite local fallback (`apod_local.db`).
- **Search Engine**: **Elasticsearch 8.15.0** (Standard multi-match, edge N-gram instant autocomplete analyzer, date histogram aggregations).
- **Vector Search / Machine Learning**: `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dimensional dense embeddings).
- **Testing**: **Pytest** integration and unit test suite.

---

## 2. Directory Structure & Key Files

```
final_fs_dbms/
├── LLM_CONTEXT.md               # [THIS FILE] Complete LLM context & system architecture guide
├── README.md                    # Project quickstart and setup instructions
├── IMPLEMENTATION_PLAN.md       # Technical design and component migration plan
├── requirements.txt             # Backend Python dependencies
├── .env / .env.example          # Environment configuration (DATABASE_URL, ELASTICSEARCH_URL)
├── apod_local.db                # SQLite database for offline/local fallback
├── app_backend/                 # Flask REST API Backend
│   ├── __init__.py              # Package init
│   ├── app.py                   # Flask app initialization, CORS, Blueprint registration
│   ├── config.py                # Environment configuration loader (Postgres/SQLite, ES URLs)
│   ├── db.py                    # Shared SQLAlchemy db instance
│   ├── models.py                # SQLAlchemy ORM models (ApodDocument, Planet)
│   ├── routes.py                # REST API Blueprint routes (/api/v1/*)
│   ├── es_client.py             # Elasticsearch wrapper, indexing logic, fallback & deduplication
│   ├── planet_service.py        # Business logic for Planet entity CRUD operations
│   └── seed_data.py             # Ingestion script: seeds DB from data/apod.json & indexes to ES
├── data/
│   └── apod.json                # JSON dataset containing 3,333 APOD records
├── frontend-react/              # React.js Vite Frontend Application
│   ├── package.json             # Frontend dependencies (React 18, Axios, Lucide-React, Vite)
│   ├── vite.config.js           # Vite dev server configuration (port 3000, proxy settings)
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Main App layout component & global search state manager
│       ├── index.css            # Dark space theme CSS, Glassmorphism styles, Animations
│       └── components/
│           ├── SearchSection.jsx     # Search bar, tokenizer toggle, instant query handler
│           ├── GallerySection.jsx    # Card grid view, shimmers, modal click handler
│           ├── PaginationBar.jsx     # Page controls, records-per-page selector, year filter
│           ├── ImagePopover.jsx      # High-res modal preview dialog for selected APOD card
│           ├── CreatePlanetModal.jsx # Form modal for adding/editing planet entities
│           ├── StarsBackground.jsx   # Interactive canvas-rendered twinkling stars background
│           └── BackToTop.jsx         # Scroll-to-top floating navigation button
└── tests/
    ├── test_backend_api.py      # Pytest integration tests for search, CRUD, and fallback
    └── test_planets_api.py      # Pytest integration tests for Planet entity endpoints
```

---

## 3. Data Models & Database Schemas

### 3.1 Relational Database (`app_backend/models.py`)

#### `ApodDocument` (Table: `apod_documents`)
- `id` (`Integer`, Primary Key, autoincrementing)
- `date` (`Date`, Unique, Index, Nullable=False) — e.g. `2024-11-13`
- `title` (`String(500)`, Nullable=False)
- `explanation` (`Text`, Nullable=False)
- `image_url` (`String(1000)`, Nullable=True)
- `authors` (`String(500)`, Nullable=True)
- `created_at` (`DateTime`, Default=`utc_now`)
- `updated_at` (`DateTime`, Default=`utc_now`, OnUpdate=`utc_now`)

#### `Planet` (Table: `planets`)
- `id` (`Integer`, Primary Key, autoincrementing)
- `name` (`String(100)`, Unique, Nullable=False)
- `type` (`String(50)`, Nullable=False) — e.g., "Terrestrial", "Gas Giant", "Ice Giant"
- `diameter_km` (`Float`, Nullable=True)
- `distance_from_sun_au` (`Float`, Nullable=True)
- `has_rings` (`Boolean`, Default=False)
- `created_at` (`DateTime`, Default=`utc_now`)

---

### 3.2 Elasticsearch Indices (`app_backend/es_client.py`)

1. **`apod`**: Standard full-text search index.
   - Analyzer: `standard`
   - Fields: `title` (boosted ^2), `explanation`, `date`, `authors`, `image_url`
2. **`apod_n_gram`**: Autocomplete & partial word search index.
   - Custom Analyzer: `n_gram_analyzer` with `edge_ngram` token filter (`min_gram=1`, `max_gram=30`).
3. **`apod_embedding`**: Vector search index.
   - Vector field: `explanation_vector` (Dense vector, 384 dimensions, cosine similarity).

---

## 4. End-to-End Query & Search Execution Flow

When a user executes a search request in the UI:

```
[User Input: "galaxy"] 
       │
       ▼
[SearchSection.jsx] ──(HTTP GET /api/v1/regular_search?search_query=galaxy&skip=0&limit=10)──► [routes.py]
                                                                                                  │
                                                   ┌──────────────────────────────────────────────┘
                                                   ▼
                                    [es_client.py: ESClientWrapper]
                                                   │
                          ┌────────────────────────┴────────────────────────┐
                          ▼ (Elasticsearch Online)                          ▼ (Elasticsearch Offline)
            [ES DSL Query: multi_match]                      [Fallback: Neon PostgreSQL / SQLite]
             - Searches title^2 & explanation                 - SQL: ILIKE '%galaxy%' across title/explanation
             - Filters by year if selected                     - ORDER BY date DESC LIMIT 10 OFFSET 0
                          │                                                 │
                          └────────────────────────┬────────────────────────┘
                                                   ▼
                                     [Hit Deduplication Logic]
                                      - Deduplicates cards by (title, date)
                                                   │
                                                   ▼
                                    [JSON Response to React Frontend]
                                      { "total": 150, "hits": [...], "max_pages": 15 }
                                                   │
                                                   ▼
                                   [GallerySection.jsx renders UI cards]
```

---

## 5. API Endpoints Reference (`app_backend/routes.py` & `planet_service.py`)

| Method | Endpoint | Description | Query / Body Parameters |
|---|---|---|---|
| `GET` | `/api/v1/health` | Health check endpoint | Returns backend & ES status |
| `GET` | `/api/v1/regular_search` | Standard & N-Gram full-text search | `search_query`, `skip`, `limit`, `year`, `tokenizer` ("standard" or "n_gram") |
| `GET` | `/api/v1/semantic_search` | Vector similarity search | `search_query`, `limit` |
| `GET` | `/api/v1/get_docs_per_year_count` | Year aggregations count | Returns histogram of APOD records per year |
| `GET` | `/api/v1/documents` | List APOD records with pagination | `skip`, `limit` |
| `POST` | `/api/v1/documents` | Create new APOD record | JSON body: `{date, title, explanation, image_url, authors}` |
| `GET` | `/api/v1/documents/<id>` | Fetch single APOD document | Path parameter: document `id` |
| `PUT` | `/api/v1/documents/<id>` | Update existing APOD document | JSON body with updated fields |
| `DELETE` | `/api/v1/documents/<id>` | Delete single APOD document | Path parameter: document `id` |
| `POST` | `/api/v1/sync_db_to_es` | Trigger PostgreSQL to ES sync | Bulk indexes DB documents to ES |
| `GET` | `/api/v1/planets` | List all planet entities | Returns list of planets |
| `POST` | `/api/v1/planets` | Create a new planet entity | JSON body: `{name, type, diameter_km, distance_from_sun_au, has_rings}` |
| `GET` | `/api/v1/planets/<id>` | Get planet details | Path parameter: planet `id` |
| `PUT` | `/api/v1/planets/<id>` | Update planet details | JSON body with updated attributes |
| `DELETE` | `/api/v1/planets/<id>` | Delete planet record | Path parameter: planet `id` |

---

## 6. Key Design Decisions & Code Patterns

1. **Hybrid Fault-Tolerant Search Architecture**:
   - The app attempts to search via Elasticsearch first for optimal speed and relevancy.
   - If Elasticsearch is offline or unavailable, the backend seamlessly falls back to PostgreSQL (or SQLite) `ILIKE` queries without returning an error to the user.
2. **Hit Deduplication**:
   - To prevent duplicate entries when indexing or querying multiple ES indices, hits are deduplicated using a `(title, date)` composite key set in `es_client.py`.
3. **Database Dual-Mode Support**:
   - In production or configured environments, `DATABASE_URL` connects to Neon Serverless PostgreSQL.
   - For local development without external credentials, `config.py` automatically falls back to local SQLite (`apod_local.db`).
4. **Instant Autocomplete via N-Gram Tokenizer**:
   - `SearchSection.jsx` allows toggling between standard search and N-Gram autocomplete tokenizer.

---

## 7. Operational & Development Commands

```bash
# 1. Activate Python Virtual Environment
source .venv/bin/activate

# 2. Install Backend Dependencies
pip install -r requirements.txt

# 3. Seed Database & Index into Elasticsearch
python3 -m app_backend.seed_data

# 4. Run Flask REST API Server (Port 5000)
PYTHONPATH=. python3 -m app_backend.app

# 5. Run React Development Server (Port 3000)
cd frontend-react && npm run dev

# 6. Execute Integration Test Suite
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

---

*This file serves as the definitive reference context for AI assistants and LLMs working on this codebase.*

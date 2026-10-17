# Project Context & Architecture Guide: APOD Astronomy Search Engine

> **Purpose**: This document provides a complete, concise, and structured technical context of the APOD Search Engine project to enable any LLM (or AI assistant) to quickly understand the system architecture, codebase layout, database schemas, API contracts, search flows, and development workflows.

---

## 1. Executive Summary & Technology Stack

The **APOD Astronomy Search Engine** is a full-stack web application for searching, discovering, and managing NASA's Astronomy Picture of the Day (APOD) records and planetary data.

- **Frontend**: **React 18** (Vite 5, Axios), styled exclusively with **Tailwind CSS v4** (`@tailwindcss/vite` plugin). Font Awesome icons and the Roboto Condensed font are loaded from CDNs in `index.html`. The starfield background is made of CSS-animated `<div>`s.
- **Backend**: **Flask** REST API (Flask-CORS, Flask-SQLAlchemy) using a **routes → controllers** pattern.
- **Primary Relational DB**: **PostgreSQL** (hosted serverless on **Neon DB**, `psycopg2-binary`). If `DATABASE_URL` is unset, `config.py` falls back to SQLite (`sqlite:///apod.db`).
- **Search Engine**: **Elasticsearch 8.15.0** (multi-match with fuzziness, edge n-gram index, date histogram aggregations).
- **Vector Search (optional)**: `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim embeddings) is *not* in `requirements.txt` (commented out). Without it, embedding generation is skipped and `/semantic_search` behaves exactly like `/regular_search`.
- **Testing**: **Pytest** integration tests (run against the database configured in `.env`).

---

## 2. Directory Structure & Key Files

```
final_fs_dbms/
├── LLM_CONTEXT.md               # [THIS FILE] Complete LLM context & system architecture guide
├── README.md                    # Project quickstart and setup instructions
├── IMPLEMENTATION_PLAN.md       # Historical technical design / migration plan
├── requirements.txt             # Backend Python dependencies
├── render.yaml                  # Render Blueprint: free web service, gunicorn start command, env vars
├── .gitignore                   # Ignores .env, .venv, __pycache__, node_modules, dist, *.db, instance/, *.bak
├── .env.example                 # Template for .env (placeholders only; .env itself is git-ignored)
├── app_backend/                 # Flask REST API Backend
│   ├── __init__.py              # Package init
│   ├── app.py                   # create_app(): config, CORS (/api/*), db.init_app, register_routes(app), ES index init
│   ├── config.py                # Env config: DB URL + pool options, CORS_ORIGINS, ELASTICSEARCH_ENABLED/NODE, PORT
│   ├── db.py                    # Shared SQLAlchemy db instance
│   ├── models.py                # SQLAlchemy ORM models (ApodDocument, Planet, OutboxEvent)
│   ├── routes/                  # HTTP layer only: Blueprints, request parsing, JSON responses
│   │   ├── __init__.py          # api_v1 parent Blueprint (/api/v1) + register_routes(app)
│   │   ├── health_routes.py     # /health
│   │   ├── search_routes.py     # /regular_search, /semantic_search, /get_docs_per_year_count
│   │   ├── document_routes.py   # /documents CRUD, /sync_db_to_es (+ ServiceError → {"error": ...} handler)
│   │   └── planet_routes.py     # /planets
│   ├── controllers/             # Business logic, DB queries, ES calls (no Flask request/jsonify)
│   │   ├── errors.py            # ServiceError (message, error_code, status_code, details)
│   │   ├── health_controller.py # DB ping + ES availability
│   │   ├── search_controller.py # ES search with PostgreSQL fallback, planet merge, dedup, year counts
│   │   ├── document_controller.py # List/get/create/delete APOD docs, DB → ES sync
│   │   └── planet_controller.py # PlanetService + PlanetServiceError: validation, insert, ES/outbox sync
│   ├── es_client.py             # Elasticsearch wrapper: index creation, bulk indexing, search, aggregations
│   ├── apod.json                # Seed dataset: 3,333 APOD records with NASA image URLs (images-assets.nasa.gov)
│   └── seed_data.py             # Ingestion script: seeds DB from app_backend/apod.json & indexes to ES
├── data/                        # Auxiliary datasets (synonyms, raw/dummy data) — not used by the seeder
├── frontend-react/              # React.js Vite Frontend Application
│   ├── index.html               # Loads fonts/Font Awesome; <body> carries base Tailwind classes
│   ├── package.json             # React 18, Axios, Vite 5, tailwindcss + @tailwindcss/vite
│   ├── vite.config.js           # Plugins: react(), tailwindcss(); dev server on port 3000 (no proxy)
│   └── src/
│       ├── main.jsx             # React entry point (imports index.css)
│       ├── App.jsx              # Main layout component & global search state manager
│       ├── index.css            # Tailwind entry only: @import "tailwindcss" + @theme tokens
│       ├── styles/text.js       # MEDIUM_TEXT / SMALL_TEXT responsive class strings
│       └── components/          # All styling via Tailwind utility classes (no <style> blocks)
│           ├── SearchSection.jsx     # Logo, "Add Planet Record" button, search input, triggers searches
│           ├── PaginationBar.jsx     # Year filter, search method, tokenizer, page size, page buttons
│           ├── GallerySection.jsx    # Card grid, shimmer loaders, delete button, opens ImagePopover
│           ├── ImagePopover.jsx      # Full-size image preview (Esc / click-outside to close, delete)
│           ├── CreatePlanetModal.jsx # Form modal for creating planet records (POST /planets)
│           ├── StarsBackground.jsx   # 60 randomly placed, CSS-animated rising stars
│           └── BackToTop.jsx         # Scroll-to-top floating button
└── tests/
    ├── test_backend_api.py      # Integration tests: health, search, year counts, documents CRUD, ES fallback
    └── test_planets_api.py      # Integration tests: planet creation, validation, duplicates, outbox fallback
```

---

## 3. Data Models & Database Schemas

### 3.1 Relational Database (`app_backend/models.py`)

#### `ApodDocument` (Table: `apod_documents`)
- `id` (`Integer`, Primary Key, autoincrement)
- `date` (`Date`, Unique, Index, Nullable=False) — e.g. `2024-11-13`
- `year` (`Integer`, Index, Nullable=True) — auto-filled from `date` in `__init__`
- `title` (`String(500)`, Nullable=False)
- `explanation` (`Text`, Nullable=False)
- `image_url` (`String(1000)`, Nullable=True)
- `authors` (`String(500)`, Nullable=True)
- `created_at`, `updated_at` (`DateTime`, default `datetime.utcnow`; `updated_at` also on update)

#### `Planet` (Table: `planets`)
- `id` (`BigInteger`, Primary Key, autoincrement)
- `name` (`String(255)`, Unique, Index, Nullable=False)
- `discovery_year` (`Integer`, Index, Nullable=True) — validated to −5000…2100
- `planet_type` (`String(100)`, Index, Nullable=False) — e.g. "Exoplanet", "Terrestrial", "Gas Giant"
- `description` (`Text`, Nullable=False)
- `atmosphere_summary` (`Text`, Nullable=True)
- `created_at`, `updated_at` (`DateTime`)

#### `OutboxEvent` (Table: `outbox_events`)
Written when a new planet cannot be indexed into Elasticsearch, for later reconciliation.
- `id` (`BigInteger`, PK), `aggregate_type` (default `planet`), `aggregate_id`, `event_type` (e.g. `PLANET_CREATED`), `payload` (JSON text), `status` (default `PENDING`, indexed), `retry_count`, `created_at`

---

### 3.2 Elasticsearch Indices (`app_backend/es_client.py`)

1. **`apod`**: Standard full-text index for APOD documents (`title`, `explanation`, `date`, `authors`, `image_url`).
2. **`apod_n_gram`**: Partial-word index. Custom `autocomplete` analyzer using an `edge_ngram` tokenizer (`min_gram=1`, `max_gram=30`, letters/digits) + lowercase; `search_analyzer` is `standard`.
3. **`apod_embedding`**: Vector index with `embedding` field (`dense_vector`, 384 dims, cosine). Only populated when `sentence-transformers` is installed.
4. **`planets_index`**: Planet records (same edge n-gram analyzer). Written by `index_planet_document()` on planet creation.

The seeder recreates indices 1–3; all four are created on app start if missing.

---

## 4. End-to-End Query & Search Execution Flow

When a user executes a search request in the UI:

```
[User Input: "galaxy"]
       │
       ▼
[SearchSection.jsx] ──(HTTP GET /api/v1/regular_search?search_query=galaxy&skip=0&limit=10)──► [routes/search_routes.py]
                                                                                                  │
                                                   ┌──────────────────────────────────────────────┘
                                                   ▼
                                   [controllers/search_controller.py]
                                                   │
                          ┌────────────────────────┴────────────────────────┐
                          ▼ (Elasticsearch online)                          ▼ (es_client returns None)
         [es_client.search_regular: multi_match]             [Fallback: PostgreSQL / SQLite]
          - apod (or apod_n_gram) + planets_index             - ILIKE '%galaxy%' on ApodDocument & Planet
          - fields: title^2, name^2, explanation,             - ORDER BY date DESC, OFFSET skip LIMIT limit
            description, atmosphere_summary                   - optional year filter
          - fuzziness AUTO (standard), year filter
                          │                                                 │
                          └────────────────────────┬────────────────────────┘
                                                   ▼
                                     [Hit Deduplication Logic]
                                      - Deduplicates cards by (title, date)
                                                   │
                                                   ▼
                                    [JSON Response to React Frontend]
                                      { "total": N, "max_pages": P, "hits": [...], "documents": [...] }
                                                   │
                                                   ▼
                                   [GallerySection.jsx renders UI cards]
```

---

## 5. API Endpoints Reference (`app_backend/routes/` & `app_backend/controllers/`)

All endpoints are mounted under `/api/v1`.

| Method | Endpoint | Description | Query / Body Parameters |
|---|---|---|---|
| `GET` | `/api/v1/health` | DB + ES status; 200 if DB connected, else 500 | — |
| `GET` | `/api/v1/regular_search` | Full-text search over APOD docs and planets | `search_query`, `skip`, `limit` (default 10), `year`, `tokenizer` (`standard` or `n_gram`) |
| `GET` | `/api/v1/semantic_search` | Currently identical to `regular_search` (vector search not wired up) | same as `regular_search` |
| `GET` | `/api/v1/get_docs_per_year_count` | APOD record counts per year | `search_query` (optional) → `{docs_per_year, year_counts}` |
| `GET` | `/api/v1/documents` | List APOD records, newest first | `skip`, `limit` (default 20), `year` |
| `POST` | `/api/v1/documents` | Create APOD record (also indexed into ES) | JSON `{date (YYYY-MM-DD), title, explanation, image_url?, authors?}`; 400 invalid, 409 date exists |
| `GET` | `/api/v1/documents/<id>` | Fetch single APOD document | 404 if missing |
| `DELETE` | `/api/v1/documents/<id>` | Delete from DB and all ES indices | 404 if missing |
| `POST` | `/api/v1/sync_db_to_es` | Bulk re-index all DB documents into ES | 503 if ES unavailable |
| `POST` | `/api/v1/planets` | Create planet (ES index, or outbox event if ES fails) | JSON `{name, planet_type, description, discovery_year?, atmosphere_summary?}`; 400 `VALIDATION_FAILED`, 409 `RESOURCE_ALREADY_EXISTS` |

Error response shapes: document endpoints return `{"error": "<message>"}`; planet endpoints return `{"status": "error", "error_code", "message", "details"}`.

---

## 6. Key Design Decisions & Code Patterns

1. **Routes → Controllers Separation**:
   - `routes/*.py` only parse the request, call one controller function, and build the JSON response + status code.
   - `controllers/*.py` contain all business logic and never import Flask's `request`/`jsonify`. Errors are raised as `ServiceError` (or its subclass `PlanetServiceError`) and mapped to HTTP responses in the route layer.
   - Sub-Blueprints (`health`, `search`, `documents`, `planets`) are nested under one `api_v1` parent Blueprint, so the `/api/v1` prefix is defined once in `routes/__init__.py`.
2. **Hybrid Fault-Tolerant Search**:
   - Elasticsearch is tried first; if it is unavailable or errors (`es_client` returns `None`), `search_controller.py` falls back to SQL `ILIKE` queries without returning an error to the user.
3. **Hit Deduplication**: Results are deduplicated by a `(title, date)` key in `es_client.py` / `search_controller.py`, and again in `GallerySection.jsx`.
4. **Outbox Pattern for Planets**: Planet creation commits to PostgreSQL first, then indexes into `planets_index`; on failure, an `OutboxEvent` (`PENDING`) is stored so the index can be reconciled later.
5. **Seeding**: `seed_data.py` reads `app_backend/apod.json` (keys: `date`, `title`, `explanation`, `image_url`, `authors`), skips existing dates and records with an empty title/explanation, inserts in chunks of 500, then rebuilds the ES indices.
6. **Frontend Styling (Tailwind only)**:
   - No hand-written CSS: `index.css` contains only `@import "tailwindcss"` and an `@theme` block.
   - Theme tokens: colors `primary` (#fffffe), `accent` (#ea5e13), `accent-hover`, `space` (#080e1a, page background), `panel`, `star-blue`; font `sans` = Roboto Condensed; animations `fade-in`, `scale-in`, `shimmer`, `star`.
   - Custom breakpoints replace the defaults to mirror the original desktop-first design: `xs` 481px, `sm` 577px, `md` 769px, `lg` 993px, `xl` 1441px, `2xl` 1921px (classes are written mobile-first).
   - Repeated class lists live in constants (`styles/text.js`, or `FIELD` / `SELECT` / `PAGE_BTN` / `POPOVER_BTN` at the top of a component). Only runtime-random star values remain as inline `style`.
7. **Deployment**: Render runs `gunicorn app_backend.app:app` (see `render.yaml`), Vercel serves the Vite build from `frontend-react/`. `CORS_ORIGINS` restricts browser origins; `ELASTICSEARCH_ENABLED=false` forces the PostgreSQL fallback; HTTP errors under `/api/` are returned as JSON `{"error": ...}`.
8. **Frontend → Backend URL**: Components call `${VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/...`; there is no Vite proxy. The tokenizer dropdown labels (`Standard`, `N-Gram`) are mapped to the API values `standard` / `n_gram` via `TOKENIZER_PARAMS` in `SearchSection.jsx`.

---

## 7. Operational & Development Commands

```bash
# 0. Start Elasticsearch 8.15.0 in Docker (first time: docker run; afterwards: docker start elasticsearch)
docker run -d --name elasticsearch -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.15.0

# 1. Activate Python Virtual Environment
source .venv/bin/activate

# 2. Install Backend Dependencies
pip install -r requirements.txt
cp .env.example .env            # then fill in real values

# 3. Seed Database & Index into Elasticsearch (--drop wipes apod_documents first)
PYTHONPATH=. python3 -m app_backend.seed_data [--drop] [--no-recreate-es] [--no-embeddings]

# 4. Run Flask REST API Server (Port 5000)
PYTHONPATH=. python3 -m app_backend.app

# 5. Run React Development Server (Port 3000)
cd frontend-react && npm install && npm run dev

# 6. Execute Integration Test Suite (uses the DB from .env)
PYTHONPATH=. pytest tests/ -v
```

---

*This file serves as the definitive reference context for AI assistants and LLMs working on this codebase.*

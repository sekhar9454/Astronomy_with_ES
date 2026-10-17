# APOD Astronomy Search Engine

Astronomy Picture of the Day (APOD) search engine powered by **React.js** (styled with **Tailwind CSS**), **Flask**, **Neon PostgreSQL**, and **Elasticsearch (v8.15)**.

---

## Quick Start (after first-time setup)

Once the setup steps below have been done once, start the project from the repository root with:

```bash
# 1. Start Elasticsearch (needed after every reboot)
docker start elasticsearch

# 2. Start the backend (terminal 1)
source .venv/bin/activate
PYTHONPATH=. python3 -m app_backend.app

# 3. Start the frontend (terminal 2)
cd frontend-react
npm run dev
```

Then open **http://localhost:3000**. Backend check: http://localhost:5000/api/v1/health should show `"database":"connected","elasticsearch":"connected"`.

If a server fails with "address already in use", an old copy is still running. Stop it and start again:
```bash
pkill -f "app_backend.app"                        # backend on port 5000
pkill -f "frontend-react/node_modules/.bin/vite"  # frontend on port 3000
```

Re-seeding is only needed if the Elasticsearch container was recreated or `app_backend/apod.json` changed (step 3 below).

---

## Execution Commands

Here are all the commands needed to install, seed, run, and test the application for the first time:

### 1. Environment Setup & Dependency Installation
```bash
# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Create your local environment file and fill in DATABASE_URL, SECRET_KEY, etc.
cp .env.example .env
```

> `.env` is git-ignored — never commit real credentials. Only `.env.example` (placeholders) is tracked.

### 2. Install Elasticsearch
Runs Elasticsearch 8.15.0 in Docker as a single node on `http://localhost:9200`, with security disabled for local development (matches `ELASTICSEARCH_NODE` in `.env.example`):
```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.15.0

curl http://localhost:9200   # should print the cluster info once it has started (~20 s)
```
Later sessions: `docker start elasticsearch` / `docker stop elasticsearch`. If port 9200 is already taken by another Elasticsearch, stop that one first.

> The container has no volume, so its indices live inside the container: `docker rm elasticsearch` deletes them. Re-run the seeder (step 3) to rebuild them from PostgreSQL. If Elasticsearch is not running, the app still works using the PostgreSQL fallback.

### 3. Database Seeding & Elasticsearch Indexing
Loads the APOD records from [`app_backend/apod.json`](app_backend/apod.json) (3,333 records with NASA image URLs) into PostgreSQL and bulk-indexes them into Elasticsearch (`apod`, `apod_n_gram`, `apod_embedding` indices):
```bash
source .venv/bin/activate
PYTHONPATH=. python3 -m app_backend.seed_data          # insert new records, recreate ES indices
PYTHONPATH=. python3 -m app_backend.seed_data --drop   # wipe the apod_documents table first, then re-seed
```
Other flags: `--no-recreate-es` (keep existing ES indices), `--no-embeddings` (skip vector embeddings; they are also skipped automatically when `sentence-transformers` is not installed).

Records with an empty title or explanation are skipped (6 in the current dataset), so the table ends up with 3,327 rows.

### 4. Start Flask Backend API Server
Runs the REST API server at `http://localhost:5000` (all endpoints are under `/api/v1`, e.g. `http://localhost:5000/api/v1/health`):
```bash
source .venv/bin/activate
PYTHONPATH=. python3 -m app_backend.app
```

### 5. Start React Frontend Server
Runs the Vite React development server at `http://localhost:3000`:
```bash
cd frontend-react
npm install   # First time only
npm run dev
```

### 6. Run Automated Tests
Runs the Pytest integration suite covering health checks, CRUD, search, planets, and fallback mechanisms:
```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

> ⚠️ The tests use the database configured in `.env` (there is no separate test database).

---

## ☁️ Deployment (free tiers: Render + Vercel + Neon)

| Part | Host | Notes |
|---|---|---|
| Flask API | [Render](https://render.com) free web service | Configured by [`render.yaml`](render.yaml); runs on **gunicorn**. Sleeps after 15 min idle; the next request takes ~1 min to wake it |
| React frontend | [Vercel](https://vercel.com) | Static Vite build from `frontend-react/` |
| PostgreSQL | Neon | Already hosted; seed it once from your machine |
| Elasticsearch | optional (e.g. Bonsai Sandbox, Elastic Cloud trial) | Without it, search uses the PostgreSQL fallback (no relevance ranking, typo tolerance, n-gram or multi-page results) |

**Before deploying:** rotate any credentials that were ever committed (Neon password, `SECRET_KEY`) and push the repo to GitHub.

### 1. Backend on Render
1. Render dashboard → **New → Blueprint** → select this repo. Render reads `render.yaml` and creates the `apod-search-api` web service.
2. When prompted, fill in:
   - `DATABASE_URL` — your Neon connection string
   - `CORS_ORIGINS` — your Vercel URL, e.g. `https://your-app.vercel.app` (comma-separate several; you can set it after step 2)
   - `ELASTICSEARCH_NODE` — leave empty unless you have a hosted cluster
3. Deploy, then open `https://<service>.onrender.com/api/v1/health` → `"database":"connected"`.

`render.yaml` sets the rest: Python 3.12.7, `pip install -r requirements.txt`, `gunicorn app_backend.app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60`, a generated `SECRET_KEY`, the health check path, and `ELASTICSEARCH_ENABLED=false`.

### 2. Frontend on Vercel
1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory:** `frontend-react` (framework preset **Vite**; build `npm run build`, output `dist`).
3. **Environment variable:** `VITE_API_BASE_URL` = `https://<service>.onrender.com` (no trailing slash, no `/api/v1`). It is baked in at build time, so redeploy after changing it.
4. Deploy, then put the resulting URL into `CORS_ORIGINS` on Render (step 1.2) if you have not already.

### 3. Optional: hosted Elasticsearch
1. Create a cluster (choose **Elasticsearch 8.x, not OpenSearch** — the `elasticsearch` Python client refuses OpenSearch servers).
2. From your machine, point `.env` at it (`ELASTICSEARCH_NODE`, plus `ELASTICSEARCH_API_KEY` or username/password) and run `PYTHONPATH=. python3 -m app_backend.seed_data --no-embeddings` to build the indices from Neon.
3. On Render set `ELASTICSEARCH_NODE` (and credentials) and `ELASTICSEARCH_ENABLED=true`, then redeploy. `/health` should show `"elasticsearch":"connected"`.

### Production settings reference

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Render | Neon PostgreSQL URL |
| `SECRET_KEY` | Render | Flask secret (auto-generated by the blueprint) |
| `CORS_ORIGINS` | Render | Allowed browser origins for `/api/*` (default `*` for local dev) |
| `ELASTICSEARCH_ENABLED` | Render | `false` skips Elasticsearch entirely and uses the PostgreSQL fallback |
| `ELASTICSEARCH_NODE`, `_API_KEY`, `_USERNAME`, `_PASSWORD` | Render | Hosted cluster connection |
| `VITE_API_BASE_URL` | Vercel | Public URL of the Render API |

> The API has no authentication: anyone with the URL can create planets and delete APOD records. Keep that in mind before sharing a public link. They create and then delete their own test rows (dates in 2099, planets named `… Test`), but the outbox test's cleanup deletes **all** `PLANET_CREATED` outbox events.

---

## 🗂️ Project Structure

```
app_backend/
├── app.py              # Flask app factory: config, CORS, DB, register_routes(app)
├── routes/             # HTTP layer only: Blueprints, request parsing, JSON responses
│   ├── __init__.py     # Parent /api/v1 Blueprint + register_routes(app)
│   ├── health_routes.py, search_routes.py, document_routes.py, planet_routes.py
├── controllers/        # Business logic: DB queries, Elasticsearch calls, validation
│   ├── errors.py       # ServiceError (message, error_code, status_code, details)
│   ├── health_controller.py, search_controller.py, document_controller.py, planet_controller.py
├── es_client.py        # Elasticsearch wrapper (indices, bulk indexing, search, aggregations)
├── models.py           # SQLAlchemy models: ApodDocument, Planet, OutboxEvent
├── apod.json           # Seed dataset
└── seed_data.py        # Seeding / indexing script
frontend-react/
├── vite.config.js      # React + Tailwind (@tailwindcss/vite) plugins, dev server on port 3000
└── src/
    ├── index.css       # Tailwind entry: @import "tailwindcss" + @theme tokens (colors, font, breakpoints, animations)
    ├── styles/text.js  # Shared responsive text-size class strings
    └── components/     # React components, styled only with Tailwind utility classes
```

**Routes vs. controllers:** route functions read query/body parameters, call one controller function, and turn the result into `jsonify(...)` plus a status code. Controllers never touch Flask's `request` or `jsonify`; they return plain data or raise `ServiceError`, which the route layer maps to an error response.

---

## 🔄 End-to-End Query Execution Flow (Layer-by-Layer & File-by-File)

When a user types a search query (e.g. `"galaxy"`) into the search bar, the request traverses through **5 architectural layers**:

```
+-----------------------------------------------------------------------------------------------------------+
|                                    1. FRONTEND USER INTERACTION                                           |
| User types "galaxy" -> SearchSection.jsx captures query & triggers performSearch()                         |
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                         HTTP GET /api/v1/regular_search
                                         ?search_query=galaxy&skip=0&limit=10
                                                     |
                                                     v
+-----------------------------------------------------------------------------------------------------------+
|                                      2. FLASK ROUTE + CONTROLLER                                          |
| routes/search_routes.py :: regular_search() parses params -> controllers/search_controller.regular_search()|
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                                     | Tries Elasticsearch First
                                                     v
+-----------------------------------------------------------------------------------------------------------+
|                                   3. ELASTICSEARCH SEARCH ENGINE LAYER                                    |
| app_backend/es_client.py :: ESClientWrapper.search_regular()                                              |
| - Multi-match search over `apod` (or `apod_n_gram`) + `planets_index`                                     |
| - Deduplicates hits by (title, date) key to ensure single-instance cards                                  |
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                                     | (If ES is offline/unreachable)
                                                     v (Fallback, in search_controller.py)
+-----------------------------------------------------------------------------------------------------------+
|                                   4. NEON POSTGRESQL DATABASE FALLBACK                                    |
| app_backend/models.py :: ApodDocument, Planet                                                             |
| - ILIKE %galaxy% across APOD title/explanation and planet name/description/atmosphere                     |
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                         JSON Response Payload:
                                         { "hits": [...], "documents": [...], "total": N, "max_pages": P }
                                                     |
                                                     v
+-----------------------------------------------------------------------------------------------------------+
|                                     5. FRONTEND DISPLAY & RENDERING                                       |
| - SearchSection.jsx updates state -> GallerySection.jsx renders deduplicated cards & shimmers             |
+-----------------------------------------------------------------------------------------------------------+
```

---

### File-by-File Execution Sequence

#### Layer 1: Frontend User Interaction (`frontend-react/`)
- **[App.jsx](frontend-react/src/App.jsx)**: Top-level container holding `searchResults` state.
- **[SearchSection.jsx](frontend-react/src/components/SearchSection.jsx)**:
  - `handleQueryChange(e)`: Captures search input string `"galaxy"`.
  - `performSearch()`: Checks that query is non-empty (`query.trim()`). Constructs request URL:
    `http://localhost:5000/api/v1/regular_search?search_query=galaxy&skip=0&limit=10`
  - Sends asynchronous HTTP GET request via `axios.get()`.

#### Layer 2: Flask Routes & Controllers (`app_backend/`)
- **[app.py](app_backend/app.py)**: Initializes Flask app, configures CORS for `/api/*`, and calls `register_routes(app)`.
- **[routes/search_routes.py](app_backend/routes/search_routes.py)**:
  - Endpoint handler: `@search_bp.route('/regular_search') def regular_search()`
  - Reads query parameters `search_query`, `skip`, `limit`, `year`, `tokenizer` and passes them to the controller.
- **[controllers/search_controller.py](app_backend/controllers/search_controller.py)**:
  - Returns an empty result if the query is blank; otherwise delegates to `es_client.search_regular()`, falling back to PostgreSQL if Elasticsearch returns nothing.

#### Layer 3: Elasticsearch Search Engine (`app_backend/es_client.py`)
- **[es_client.py](app_backend/es_client.py)**:
  - Method: `search_regular(query='galaxy', skip=0, limit=10, year=None, tokenizer='standard')`
  - Formulates Elasticsearch DSL query (searched indices: `apod` + `planets_index`, or `apod_n_gram` + `planets_index` when `tokenizer=n_gram`):
    ```json
    {
      "from": 0,
      "size": 20,
      "query": {
        "bool": {
          "must": [{ "multi_match": {
            "query": "galaxy",
            "fields": ["title^2", "name^2", "explanation", "description", "atmosphere_summary"],
            "fuzziness": "AUTO"
          } }],
          "filter": []
        }
      }
    }
    ```
  - Executes request against local Elasticsearch 8.15.0 node (`http://localhost:9200`).
  - **Deduplication**: Filters raw Elasticsearch hits using a `(title, date)` tuple set so each card appears exactly once.

#### Layer 4: Relational Database Fallback (`controllers/search_controller.py`)
- **[config.py](app_backend/config.py)**: Translates `DATABASE_URL` to `postgresql+psycopg2://` format (falls back to SQLite `apod.db` if `DATABASE_URL` is unset).
- **[search_controller.py](app_backend/controllers/search_controller.py)**: If Elasticsearch is offline, queries [models.py](app_backend/models.py) `ApodDocument` and `Planet` directly:
    ```sql
    SELECT * FROM apod_documents
    WHERE title ILIKE '%galaxy%' OR explanation ILIKE '%galaxy%'
    ORDER BY date DESC LIMIT 10 OFFSET 0;
    ```
  Matching planets are mapped into the same card shape and merged ahead of the APOD results.

#### Layer 5: Response Formatting & UI Display (`frontend-react/`)
- **[routes/search_routes.py](app_backend/routes/search_routes.py)**: Formats the controller's result as JSON:
  ```json
  {
    "total": 10,
    "max_pages": 15,
    "hits": [{ "id": 101, "title": "Spiral Galaxy NGC 1365", "date": "2024-11-13", "image_url": "https://images-assets.nasa.gov/...", ... }],
    "documents": [{ ... }]
  }
  ```
- **[SearchSection.jsx](frontend-react/src/components/SearchSection.jsx)**: Receives JSON payload and calls `onSearchResults()`.
- **[GallerySection.jsx](frontend-react/src/components/GallerySection.jsx)**: Applies secondary deduplication, displays shimmer loaders, renders image cards, titles, descriptions, and opens the image popover on click.

---

## ⚙️ Architecture & Tech Stack Summary

- **Frontend**: React 18 (Vite 5, Axios), **Tailwind CSS v4** via `@tailwindcss/vite` (no hand-written CSS beyond the Tailwind entry/theme in `index.css`), Font Awesome icons, Roboto Condensed font.
- **Backend**: Flask REST API (Flask-CORS, Flask-SQLAlchemy) organised as **routes** (Blueprints, HTTP only) → **controllers** (business logic).
- **Primary Database**: PostgreSQL (hosted serverless on Neon DB), with SQLite fallback when `DATABASE_URL` is unset.
- **Search Engine**: Elasticsearch 8.15.0 (standard multi-match with fuzziness, edge n-gram index, year histogram aggregations). Planet creation uses an outbox table as fallback when Elasticsearch is unavailable.

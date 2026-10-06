# APOD Astronomy Search Engine

Enterprise Astronomy Picture of the Day (APOD) search engine powered by **React.js**, **Flask**, **Neon PostgreSQL**, and **Elasticsearch (v8.15)**.

---

## 🚀 Execution Commands

Here are all the commands needed to install, seed, run, and test the application:

### 1. Environment Setup & Dependency Installation
```bash
# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### 2. Database Seeding & Elasticsearch Indexing
Populates Neon PostgreSQL database with 3,333 APOD records and bulk-indexes into Elasticsearch (`apod` and `apod_n_gram` indices):
```bash
source .venv/bin/activate
python3 -m app_backend.seed_data
```

### 3. Start Flask Backend API Server
Runs the REST API server at `http://localhost:5000`:
```bash
source .venv/bin/activate
PYTHONPATH=. python3 -m app_backend.app
```

### 4. Start React Frontend Server
Runs the Vite React development server at `http://localhost:3000`:
```bash
cd frontend-react
npm install   # First time only
npm run dev
```

### 5. Run Automated Tests
Runs the Pytest integration suite covering health checks, CRUD, search, and fallback mechanisms:
```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/test_backend_api.py -v
```

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
|                                      2. FLASK BACKEND API ROUTER                                          |
| app_backend/routes.py :: regular_search() receives request & parses parameters                            |
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                                     | Tries Elasticsearch First
                                                     v
+-----------------------------------------------------------------------------------------------------------+
|                                   3. ELASTICSEARCH SEARCH ENGINE LAYER                                    |
| app_backend/es_client.py :: ESClientWrapper.search_regular()                                              |
| - Multi-match search across title & explanation in `apod` / `apod_n_gram` indices                         |
| - Deduplicates hits by (title, date) key to ensure single-instance cards                                  |
+----------------------------------------------------+------------------------------------------------------+
                                                     |
                                                     | (If ES is offline/unreachable)
                                                     v (Fallback)
+-----------------------------------------------------------------------------------------------------------+
|                                   4. NEON POSTGRESQL DATABASE FALLBACK                                    |
| app_backend/models.py :: ApodDocument                                                                     |
| - Queries Neon PostgreSQL DB: ILIKE %galaxy% across title/explanation                                     |
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
- **[App.jsx](file:///home/sanskar/code/final_fs_dbms/frontend-react/src/App.jsx)**: Top-level container holding `searchResults` state.
- **[SearchSection.jsx](file:///home/sanskar/code/final_fs_dbms/frontend-react/src/components/SearchSection.jsx)**:
  - `handleQueryChange(e)`: Captures search input string `"galaxy"`.
  - `performSearch()`: Checks that query is non-empty (`query.trim()`). Constructs request URL:
    `http://localhost:5000/api/v1/regular_search?search_query=galaxy&skip=0&limit=10`
  - Sends asynchronous HTTP GET request via `axios.get()`.

#### Layer 2: Flask API Gateway (`app_backend/`)
- **[app.py](file:///home/sanskar/code/final_fs_dbms/app_backend/app.py)**: Initializes Flask app, configures CORS headers (`CORS(app)`), and registers API blueprint.
- **[routes.py](file:///home/sanskar/code/final_fs_dbms/app_backend/routes.py)**:
  - Endpoint handler: `@api_bp.route('/regular_search') def regular_search()`
  - Reads query parameters: `search_query="galaxy"`, `skip=0`, `limit=10`, `tokenizer="standard"`.
  - Checks if query is non-empty; delegates search logic to `es_client.search_regular()`.

#### Layer 3: Elasticsearch Search Engine (`app_backend/es_client.py`)
- **[es_client.py](file:///home/sanskar/code/final_fs_dbms/app_backend/es_client.py)**:
  - Method: `search_regular(query='galaxy', skip=0, limit=10, year=None, tokenizer='standard')`
  - Formulates Elasticsearch DSL query:
    ```json
    {
      "from": 0,
      "size": 10,
      "query": {
        "bool": {
          "must": [{ "multi_match": { "query": "galaxy", "fields": ["title^2", "explanation"] } }]
        }
      }
    }
    ```
  - Executes request against local Elasticsearch 8.15.0 node (`http://localhost:9200`).
  - **Deduplication**: Filters raw Elasticsearch hits using a `(title, date)` tuple set so each card appears exactly once.

#### Layer 4: Relational Database Fallback (`app_backend/models.py`)
- **[config.py](file:///home/sanskar/code/final_fs_dbms/app_backend/config.py)**: Translates `DATABASE_URL` to `postgresql+psycopg2://` format.
- **[models.py](file:///home/sanskar/code/final_fs_dbms/app_backend/models.py)**:
  - Class `ApodDocument(db.Model)`
  - If Elasticsearch is offline, executes SQL fallback query against Neon PostgreSQL:
    ```sql
    SELECT * FROM apod_documents 
    WHERE title ILIKE '%galaxy%' OR explanation ILIKE '%galaxy%' 
    ORDER BY date DESC LIMIT 10 OFFSET 0;
    ```

#### Layer 5: Response Formatting & UI Display (`frontend-react/`)
- **[routes.py](file:///home/sanskar/code/final_fs_dbms/app_backend/routes.py)**: Formats response as JSON:
  ```json
  {
    "total": 150,
    "max_pages": 15,
    "hits": [{ "id": 101, "title": "Spiral Galaxy NGC 1365", "date": "2024-11-13", ... }],
    "documents": [{ ... }]
  }
  ```
- **[SearchSection.jsx](file:///home/sanskar/code/final_fs_dbms/frontend-react/src/components/SearchSection.jsx)**: Receives JSON payload and calls `onSearchResults()`.
- **[GallerySection.jsx](file:///home/sanskar/code/final_fs_dbms/frontend-react/src/components/GallerySection.jsx)**: Applies secondary deduplication, displays skeleton loaders, renders image cards, titles, descriptions, and binds modal popover click events.

---

## ⚙️ Architecture & Tech Stack Summary

- **Frontend**: React.js (Vite, React 18, Axios, Lucide Icons, Glassmorphism CSS).
- **Backend**: Flask RESTful API (Flask-CORS, Flask-SQLAlchemy, Blueprints).
- **Primary Database**: PostgreSQL (Hosted serverless on Neon DB).
- **Search Engine**: Elasticsearch 8.15.0 (Standard multi-match, edge n-gram autocomplete, year histogram aggregations).

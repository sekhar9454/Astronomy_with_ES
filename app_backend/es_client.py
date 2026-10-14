import os
import logging
from elasticsearch import Elasticsearch, helpers
from app_backend.config import Config

logger = logging.getLogger(__name__)

INDEX_STANDARD = 'apod'
INDEX_NGRAM = 'apod_n_gram'
INDEX_EMBEDDING = 'apod_embedding'

class ESClientWrapper:
    def __init__(self, node=None, api_key=None, username=None, password=None):
        self.node = node or Config.ELASTICSEARCH_NODE
        self.api_key = api_key or Config.ELASTICSEARCH_API_KEY
        self.username = username or Config.ELASTICSEARCH_USERNAME
        self.password = password or Config.ELASTICSEARCH_PASSWORD
        self._client = None
        self._init_client()

    def _init_client(self):
        try:
            kwargs = {'request_timeout': 5}
            if self.api_key:
                kwargs['api_key'] = self.api_key
            elif self.username and self.password:
                kwargs['basic_auth'] = (self.username, self.password)
            
            self._client = Elasticsearch(self.node, **kwargs)
        except Exception as e:
            logger.warning(f"Failed to initialize Elasticsearch client: {e}")
            self._client = None

    def is_available(self):
        if not self._client:
            return False
        try:
            return bool(self._client.ping())
        except Exception as e:
            logger.warning(f"Elasticsearch ping failed: {e}")
            return False

    def init_indices(self):
        if not self.is_available():
            logger.warning("Elasticsearch is not available. Skipping index creation.")
            return False

        try:
            # 1. Standard index
            if not self._client.indices.exists(index=INDEX_STANDARD):
                self._client.indices.create(
                    index=INDEX_STANDARD,
                    body={
                        "mappings": {
                            "properties": {
                                "id": {"type": "integer"},
                                "date": {"type": "date", "format": "yyyy-MM-dd"},
                                "title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                                "explanation": {"type": "text"},
                                "image_url": {"type": "keyword"},
                                "authors": {"type": "text"}
                            }
                        }
                    }
                )

            # 2. N-Gram index
            if not self._client.indices.exists(index=INDEX_NGRAM):
                self._client.indices.create(
                    index=INDEX_NGRAM,
                    body={
                        "settings": {
                            "analysis": {
                                "analyzer": {
                                    "autocomplete": {
                                        "type": "custom",
                                        "tokenizer": "autocomplete_tokenizer",
                                        "filter": ["lowercase"]
                                    }
                                },
                                "tokenizer": {
                                    "autocomplete_tokenizer": {
                                        "type": "edge_ngram",
                                        "min_gram": 1,
                                        "max_gram": 30,
                                        "token_chars": ["letter", "digit"]
                                    }
                                }
                            }
                        },
                        "mappings": {
                            "properties": {
                                "id": {"type": "integer"},
                                "date": {"type": "date", "format": "yyyy-MM-dd"},
                                "title": {
                                    "type": "text",
                                    "analyzer": "autocomplete",
                                    "search_analyzer": "standard"
                                },
                                "explanation": {
                                    "type": "text",
                                    "analyzer": "autocomplete",
                                    "search_analyzer": "standard"
                                },
                                "image_url": {"type": "keyword"},
                                "authors": {"type": "text"}
                            }
                        }
                    }
                )

            # 3. Dense Vector embedding index
            if not self._client.indices.exists(index=INDEX_EMBEDDING):
                self._client.indices.create(
                    index=INDEX_EMBEDDING,
                    body={
                        "mappings": {
                            "properties": {
                                "id": {"type": "integer"},
                                "date": {"type": "date", "format": "yyyy-MM-dd"},
                                "title": {"type": "text"},
                                "explanation": {"type": "text"},
                                "image_url": {"type": "keyword"},
                                "authors": {"type": "text"},
                                "embedding": {
                                    "type": "dense_vector",
                                    "dims": 384,
                                    "index": True,
                                    "similarity": "cosine"
                                }
                            }
                        }
                    }
                )
            # 4. Planets Index
            INDEX_PLANETS = 'planets_index'
            if not self._client.indices.exists(index=INDEX_PLANETS):
                self._client.indices.create(
                    index=INDEX_PLANETS,
                    body={
                        "settings": {
                            "analysis": {
                                "analyzer": {
                                    "autocomplete": {
                                        "type": "custom",
                                        "tokenizer": "autocomplete_tokenizer",
                                        "filter": ["lowercase"]
                                    }
                                },
                                "tokenizer": {
                                    "autocomplete_tokenizer": {
                                        "type": "edge_ngram",
                                        "min_gram": 1,
                                        "max_gram": 30,
                                        "token_chars": ["letter", "digit"]
                                    }
                                }
                            }
                        },
                        "mappings": {
                            "properties": {
                                "id": {"type": "long"},
                                "name": {
                                    "type": "text",
                                    "analyzer": "autocomplete",
                                    "search_analyzer": "standard",
                                    "fields": {
                                        "keyword": {"type": "keyword"}
                                    }
                                },
                                "discovery_year": {"type": "integer"},
                                "planet_type": {"type": "keyword"},
                                "description": {"type": "text", "analyzer": "standard"},
                                "atmosphere_summary": {"type": "text", "analyzer": "standard"},
                                "created_at": {"type": "date"},
                                "updated_at": {"type": "date"}
                            }
                        }
                    }
                )
            return True
        except Exception as e:
            logger.error(f"Error creating Elasticsearch indices: {e}")
            return False

    def recreate_indices(self):
        """
        Deletes and re-creates all APOD indices to clear stale documents during re-seeding.
        """
        if not self.is_available():
            logger.warning("Elasticsearch unavailable. Skipping index recreation.")
            return False

        for idx in [INDEX_STANDARD, INDEX_NGRAM, INDEX_EMBEDDING]:
            try:
                if self._client.indices.exists(index=idx):
                    self._client.indices.delete(index=idx)
            except Exception as e:
                logger.warning(f"Error deleting index {idx}: {e}")

        return self.init_indices()

    def delete_document(self, doc_id, date=None):
        """
        Deletes a document by ID and optional date across all APOD Elasticsearch indices:
        INDEX_STANDARD ('apod'), INDEX_NGRAM ('apod_n_gram'), and INDEX_EMBEDDING ('apod_embedding').
        Safe against offline ES or missing documents.
        """
        if not self.is_available():
            logger.warning(f"Elasticsearch unavailable. Skipping delete for document {doc_id}.")
            return False

        indices = [INDEX_STANDARD, INDEX_NGRAM, INDEX_EMBEDDING]
        date_str = date.isoformat() if hasattr(date, 'isoformat') else (str(date) if date else None)

        for index_name in indices:
            try:
                if not self._client.indices.exists(index=index_name):
                    continue

                deleted = False
                # 1. Try direct ID delete
                try:
                    res = self._client.delete(index=index_name, id=str(doc_id))
                    if res.get('result') in ['deleted', 'found']:
                        deleted = True
                except Exception as ex:
                    logger.debug(f"Direct ES delete by _id '{doc_id}' on '{index_name}' yielded: {ex}")

                # 2. Fallback to delete_by_query if direct delete didn't find the record
                if not deleted:
                    should_conditions = [
                        {"term": {"id": doc_id}},
                        {"term": {"_id": str(doc_id)}}
                    ]
                    if date_str:
                        should_conditions.append({"term": {"date": date_str}})

                    query_body = {
                        "query": {
                            "bool": {
                                "should": should_conditions,
                                "minimum_should_match": 1
                            }
                        }
                    }
                    self._client.delete_by_query(index=index_name, body=query_body, ignore_unavailable=True)

                self._client.indices.refresh(index=index_name)
            except Exception as e:
                logger.warning(f"Warning during ES document {doc_id} deletion from index '{index_name}': {e}")

        return True

    def bulk_index_documents(self, documents, generate_embeddings=False):
        if not self.is_available():
            return False

        model = None
        if generate_embeddings:
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer for vector embeddings: {e}")

        actions = []
        for doc in documents:
            doc_id = str(doc.id)
            doc_data = {
                "id": doc.id,
                "date": doc.date.isoformat() if doc.date else None,
                "title": doc.title,
                "explanation": doc.explanation,
                "image_url": doc.image_url,
                "authors": doc.authors
            }

            # Standard index action
            actions.append({
                "_index": INDEX_STANDARD,
                "_id": doc_id,
                "_source": doc_data
            })
            # N-Gram index action
            actions.append({
                "_index": INDEX_NGRAM,
                "_id": doc_id,
                "_source": doc_data
            })

            if model and doc.explanation:
                try:
                    vec = model.encode(doc.explanation).tolist()
                    embed_data = {**doc_data, "embedding": vec}
                    actions.append({
                        "_index": INDEX_EMBEDDING,
                        "_id": doc_id,
                        "_source": embed_data
                    })
                except Exception as ve:
                    logger.warning(f"Failed to generate embedding for doc {doc.id}: {ve}")

        try:
            helpers.bulk(self._client, actions)
            for idx in [INDEX_STANDARD, INDEX_NGRAM, INDEX_EMBEDDING]:
                if self._client.indices.exists(index=idx):
                    self._client.indices.refresh(index=idx)
            return True
        except Exception as e:
            logger.error(f"Error during bulk indexing: {e}")
            return False

    def search_regular(self, query=None, skip=0, limit=10, year=None, tokenizer='standard'):
        if not self.is_available():
            return None

        INDEX_PLANETS = 'planets_index'
        target_indices = [INDEX_NGRAM, INDEX_PLANETS] if tokenizer == 'n_gram' else [INDEX_STANDARD, INDEX_PLANETS]
        
        must_clause = []
        if query:
            must_clause.append({
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "name^2", "explanation", "description", "atmosphere_summary"],
                    "fuzziness": "AUTO" if tokenizer != 'n_gram' else "0"
                }
            })
        else:
            must_clause.append({"match_all": {}})

        filter_clause = []
        if year:
            filter_clause.append({
                "bool": {
                    "should": [
                        {"range": {"date": {"gte": f"{year}-01-01", "lte": f"{year}-12-31"}}},
                        {"term": {"discovery_year": int(year) if str(year).isdigit() else 0}}
                    ]
                }
            })

        body = {
            "from": skip,
            "size": limit * 2,
            "query": {
                "bool": {
                    "must": must_clause,
                    "filter": filter_clause
                }
            }
        }

        try:
            res = self._client.search(index=target_indices, body=body)
            total = res['hits']['total']['value'] if isinstance(res['hits']['total'], dict) else res['hits']['total']
            raw_hits = [hit['_source'] for hit in res['hits']['hits']]

            # Deduplicate search results by title & date so each card appears only once
            seen = set()
            unique_hits = []
            for item in raw_hits:
                title = item.get('title') or item.get('name') or 'Untitled'
                explanation = item.get('explanation') or item.get('description') or ''
                if item.get('atmosphere_summary'):
                    explanation += f" | Atmosphere: {item['atmosphere_summary']}"
                
                authors = item.get('authors') or item.get('planet_type') or ''
                if item.get('discovery_year'):
                    authors = f"{authors} (Discovered {item['discovery_year']})" if authors else f"Discovered {item['discovery_year']}"
                
                date_val = item.get('date') or (item.get('created_at', '')[:10] if item.get('created_at') else '')
                image_url = item.get('image_url') or 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=800&auto=format&fit=crop'

                key = (title.strip().lower(), str(date_val))
                if key not in seen:
                    seen.add(key)
                    unique_hits.append({
                        "id": item.get('id'),
                        "title": title,
                        "explanation": explanation,
                        "authors": authors,
                        "date": date_val,
                        "image_url": image_url
                    })

            unique_hits = unique_hits[:limit]
            max_pages = max(1, (total + limit - 1) // limit) if limit > 0 else 1
            return {"total": len(unique_hits), "max_pages": max_pages, "hits": unique_hits, "documents": unique_hits}
        except Exception as e:
            logger.error(f"ES search error: {e}")
            return None

    def get_docs_per_year_count(self, query=None):
        if not self.is_available():
            return None

        must_clause = []
        if query:
            must_clause.append({
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "explanation"]
                }
            })
        else:
            must_clause.append({"match_all": {}})

        body = {
            "size": 0,
            "query": {
                "bool": {
                    "must": must_clause
                }
            },
            "aggs": {
                "years": {
                    "date_histogram": {
                        "field": "date",
                        "calendar_interval": "year",
                        "format": "yyyy"
                    }
                }
            }
        }

        try:
            res = self._client.search(index=INDEX_STANDARD, body=body)
            buckets = res.get('aggregations', {}).get('years', {}).get('buckets', [])
            result = {b['key_as_string']: b['doc_count'] for b in buckets if b.get('key_as_string')}
            return result
        except Exception as e:
            logger.error(f"ES year aggregation error: {e}")
            return None

    def index_planet_document(self, planet):
        """
        Indexes a single Planet record into planets_index.
        Returns True on success, False on failure.
        """
        if not self.is_available():
            logger.warning("Elasticsearch unavailable. Skipping index_planet_document.")
            return False

        INDEX_PLANETS = 'planets_index'
        doc_data = {
            "id": planet.id,
            "name": planet.name,
            "discovery_year": planet.discovery_year,
            "planet_type": planet.planet_type,
            "description": planet.description,
            "atmosphere_summary": planet.atmosphere_summary,
            "created_at": planet.created_at.isoformat() if planet.created_at else None,
            "updated_at": planet.updated_at.isoformat() if planet.updated_at else None
        }

        try:
            self._client.index(
                index=INDEX_PLANETS,
                id=str(planet.id),
                document=doc_data,
                refresh=True
            )
            return True
        except Exception as e:
            logger.error(f"Failed to index planet ID {planet.id} into Elasticsearch: {e}")
            return False

# Singleton instance
es_client = ESClientWrapper()

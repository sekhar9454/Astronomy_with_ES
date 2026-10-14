from flask import Blueprint, request, jsonify
from app_backend.controllers import search_controller

search_bp = Blueprint('search', __name__)

def _search_params():
    return {
        "query": request.args.get('search_query', '').strip(),
        "skip": request.args.get('skip', 0, type=int),
        "limit": request.args.get('limit', 10, type=int),
        "year": request.args.get('year', None),
        "tokenizer": request.args.get('tokenizer', 'standard').strip(),
    }

@search_bp.route('/regular_search', methods=['GET'])
def regular_search():
    return jsonify(search_controller.regular_search(**_search_params())), 200

@search_bp.route('/semantic_search', methods=['GET'])
def semantic_search():
    return jsonify(search_controller.semantic_search(**_search_params())), 200

@search_bp.route('/get_docs_per_year_count', methods=['GET'])
def get_docs_per_year_count():
    query = request.args.get('search_query', '').strip()
    year_counts = search_controller.get_docs_per_year_count(query=query)
    return jsonify({"docs_per_year": year_counts, "year_counts": year_counts}), 200

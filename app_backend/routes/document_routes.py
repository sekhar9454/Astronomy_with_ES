from flask import Blueprint, request, jsonify
from app_backend.controllers import document_controller
from app_backend.controllers.errors import ServiceError

document_bp = Blueprint('documents', __name__)

@document_bp.errorhandler(ServiceError)
def handle_service_error(err):
    return jsonify({"error": err.message}), err.status_code

@document_bp.route('/documents', methods=['GET'])
def get_documents():
    skip = request.args.get('skip', 0, type=int)
    limit = request.args.get('limit', 20, type=int)
    year = request.args.get('year', None)

    total, docs = document_controller.list_documents(skip=skip, limit=limit, year=year)
    return jsonify({
        "total": total,
        "documents": [d.to_dict() for d in docs]
    }), 200

@document_bp.route('/documents', methods=['POST'])
def create_document():
    data = request.get_json() or {}
    doc = document_controller.create_document(data)
    return jsonify({
        "message": "Document created successfully",
        "document": doc.to_dict()
    }), 201

@document_bp.route('/documents/<int:doc_id>', methods=['GET'])
def get_document_by_id(doc_id):
    doc = document_controller.get_document(doc_id)
    return jsonify(doc.to_dict()), 200

@document_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
def delete_document_endpoint(doc_id):
    document_controller.delete_document(doc_id)
    return jsonify({
        "status": "success",
        "message": f"Document {doc_id} deleted from database and search index."
    }), 200

@document_bp.route('/sync_db_to_es', methods=['POST'])
def sync_db_to_es():
    total_indexed = document_controller.sync_db_to_es()
    return jsonify({"message": "Successfully synchronized database to Elasticsearch", "total_indexed": total_indexed}), 200

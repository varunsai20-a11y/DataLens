import os
import threading
import requests
from flask import Flask, jsonify, request
from dotenv import load_dotenv
import logging
from analyzer import analyze_file

load_dotenv()

# Configuration
PORT = int(os.getenv('ENGINE_PORT', 5000))
ENV = os.getenv('ENGINE_ENV', 'development')
STORAGE_PATH = os.getenv('STORAGE_PATH', '/app/storage')

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('datalens-engine')

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "UP", "service": "data-engine"}), 200

@app.route('/ready', methods=['GET'])
def ready():
    try:
        if not os.path.exists(STORAGE_PATH):
            os.makedirs(STORAGE_PATH, exist_ok=True)

        test_file = os.path.join(STORAGE_PATH, '.readiness_check')
        with open(test_file, 'w') as f:
            f.write('ready')
        if os.path.exists(test_file):
            os.remove(test_file)

        return jsonify({"status": "READY", "service": "data-engine"}), 200
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        return jsonify({"status": "NOT_READY", "reason": str(e)}), 503

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json() or {}
    file_path = data.get('file_path')
    stored_filename = data.get('stored_filename')

    if not file_path and not stored_filename:
        return jsonify({
            "error": "BAD_REQUEST",
            "message": "Either file_path or stored_filename must be provided."
        }), 400

    target_path = file_path if file_path else os.path.join(STORAGE_PATH, stored_filename)

    if not os.path.exists(target_path):
        logger.error(f"File not found for analysis: {target_path}")
        return jsonify({
            "error": "FILE_NOT_FOUND",
            "message": f"Dataset file does not exist: {target_path}"
        }), 404

    try:
        logger.info(f"Starting synchronous analysis for: {target_path}")
        report = analyze_file(target_path)
        return jsonify({
            "status": "SUCCESS",
            "report": report
        }), 200
    except ValueError as ve:
        logger.error(f"Data validation/parsing error: {str(ve)}")
        return jsonify({
            "error": "INVALID_DATA",
            "message": str(ve)
        }), 400
    except Exception as e:
        logger.error(f"Analysis engine error: {str(e)}", exc_info=True)
        return jsonify({
            "error": "ANALYSIS_FAILED",
            "message": f"An unexpected error occurred during dataset analysis: {str(e)}"
        }), 500

@app.route('/compare', methods=['POST'])
def compare():
    data = request.get_json() or {}
    base_file_path = data.get('base_file_path')
    target_file_path = data.get('target_file_path')
    base_report = data.get('base_report', {})
    target_report = data.get('target_report', {})

    if not base_file_path or not target_file_path:
        return jsonify({
            "error": "BAD_REQUEST",
            "message": "Both base_file_path and target_file_path are required."
        }), 400

    try:
        logger.info(f"Comparing datasets: {base_file_path} vs {target_file_path}")
        from analyzer.comparison import compare_dataset_versions
        result = compare_dataset_versions(base_file_path, target_file_path, base_report, target_report)
        return jsonify({
            "status": "SUCCESS",
            "comparison": result
        }), 200
    except Exception as e:
        logger.error(f"Version comparison error: {str(e)}", exc_info=True)
        return jsonify({
            "error": "COMPARISON_FAILED",
            "message": f"Failed to compare dataset versions: {str(e)}"
        }), 500

if __name__ == '__main__':
    logger.info(f"Starting Data Engine on port {PORT} in {ENV} mode")
    app.run(host='0.0.0.0', port=PORT)

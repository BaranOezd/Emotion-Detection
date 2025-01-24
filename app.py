import os
from flask import Flask, render_template, send_from_directory, request, jsonify
from backend.go_emotions_analyzer import GoEmotionsAnalyzer

# Disable multiprocessing for tokenizers
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = Flask(__name__, template_folder='./frontend')

# Initialize the GoEmotionsAnalyzer lazily
analyzer = GoEmotionsAnalyzer()

# Route for the main HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Route to serve CSS and JS files
@app.route('/<path:filename>')
def serve_files(filename):
    frontend_folder = os.path.join(os.path.dirname(__file__), 'frontend')
    return send_from_directory(frontend_folder, filename)

# Route to serve files from the backend folder
@app.route('/backend/<path:filename>')
def backend_files(filename):
    backend_folder = os.path.join(os.path.dirname(__file__), 'backend')
    return send_from_directory(backend_folder, filename)

# Route to analyze text dynamically
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    text = data.get("text", "")

    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Analyze the dynamic text
    results = analyzer.analyze_dynamic_text(text)

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
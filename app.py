import os
from flask import Flask, render_template, send_from_directory, request, jsonify
from backend.go_emotions_analyzer import GoEmotionsAnalyzer

# Initialize Flask app
app = Flask(__name__, template_folder='./frontend', static_folder='./frontend')

# Initialize the GoEmotionsAnalyzer
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

# Route to analyze text dynamically
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "No text provided"}), 400

        print("/analyze endpoint triggered")
        results = analyzer.analyze_dynamic_text(text)
        print("Analysis complete")
        return jsonify({"results": results})
    except Exception as e:
        print(f"Error during analysis: {e}")
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

# Route to handle file upload
@app.route("/upload", methods=["POST"])
def upload():
    try:
        print("/upload endpoint triggered")
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename.strip() == '':
            return jsonify({"error": "No file selected"}), 400

        # Read the content of the uploaded file
        content = file.read().decode('utf-8')
        if not content.strip():
            return jsonify({"error": "Uploaded file is empty"}), 400

        print(f"File received: {file.filename}")

        # Analyze the file content
        print("Calling GoEmotionsAnalyzer...")
        results = analyzer.analyze_dynamic_text(content)  # Call only once
        print("Analysis complete")

        return jsonify({"results": results})
    except Exception as e:
        print(f"Error during upload: {e}")
        return jsonify({"error": f"An error occurred during file upload: {str(e)}"}), 500

# Optional: Serve backend files for debugging or additional resources
@app.route('/backend/<path:filename>')
def backend_files(filename):
    backend_folder = os.path.join(os.path.dirname(__file__), 'backend')
    return send_from_directory(backend_folder, filename)

if __name__ == '__main__':
    app.run(debug=True)

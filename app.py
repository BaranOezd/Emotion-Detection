import os
import traceback
from flask import Flask, render_template, send_from_directory, request, jsonify
from backend.Emotions_analyzer import EmotionsAnalyzer
from backend.emotion_sentence_generator import SentenceGenerator

# Initialize Flask app with frontend templates and static files.
app = Flask(__name__, template_folder='./frontend', static_folder='./frontend')

# Instantiate the analyzer and sentence generator.
analyzer = EmotionsAnalyzer()
sentence_generator = SentenceGenerator(max_attempts=3, emotion_threshold=0.07, analyzer=analyzer)

# Route for the main HTML page.
@app.route('/')
def index():
    return render_template('index.html')

# Route to serve static CSS and JS files.
@app.route('/<path:filename>')
def serve_files(filename):
    frontend_folder = os.path.join(os.path.dirname(__file__), 'frontend')
    return send_from_directory(frontend_folder, filename)

# Endpoint to analyze text dynamically.
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
        print(traceback.format_exc())
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

# Endpoint to modify a selected sentence based on new emotion levels.
@app.route("/modify", methods=["POST"])
def modify_sentence():
    try:
        data = request.json
        print("Received data for modification:", data)
        original_sentence = data.get("sentence", "").strip()
        new_emotion_levels = data.get("new_emotions")
        context_text = data.get("context", "")
        
        if not original_sentence or not new_emotion_levels:
            return jsonify({"error": "Sentence and new_emotions must be provided"}), 400

        print("/modify endpoint triggered")
        # Generate the modified sentence
        new_sentence = sentence_generator.generate_modified_sentence(original_sentence, new_emotion_levels, context_text)
        
        # Analyze the emotions of the generated sentence
        actual_emotions = analyzer.analyze_emotions(new_sentence)
        
        # Normalize the top 3 actual emotions to two decimal places
        top_actual_emotions = dict(sorted(actual_emotions.items(), key=lambda x: x[1], reverse=True)[:3])
        normalized_top_actual_emotions = {k: round(v, 2) for k, v in top_actual_emotions.items()}
        
        print("Sentence modification complete:", new_sentence)
        print("Top 3 actual emotions (normalized):", normalized_top_actual_emotions)
        
        # Return the new sentence and its emotion levels
        return jsonify({
            "new_sentence": new_sentence,
            "emotion_levels": normalized_top_actual_emotions
        })
    except Exception as e:
        print(f"Error during sentence modification: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"An error occurred during sentence modification: {str(e)}"}), 500

# Endpoint to handle file uploads for analysis.
@app.route("/upload", methods=["POST"])
def upload():
    try:
        print("/upload endpoint triggered")
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename.strip() == '':
            return jsonify({"error": "No file selected"}), 400

        content = file.read().decode('utf-8')
        if not content.strip():
            return jsonify({"error": "Uploaded file is empty"}), 400

        print(f"File received: {file.filename}")
        print("Calling GoEmotionsAnalyzer...")
        results = analyzer.analyze_dynamic_text(content)
        print("Analysis complete")
        return jsonify({"results": results})
    except Exception as e:
        print(f"Error during upload: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"An error occurred during file upload: {str(e)}"}), 500

# Optional: Serve backend files (for debugging or additional resources).
@app.route('/backend/<path:filename>')
def backend_files(filename):
    backend_folder = os.path.join(os.path.dirname(__file__), 'backend')
    return send_from_directory(backend_folder, filename)

if __name__ == '__main__':
    app.run(debug=True)

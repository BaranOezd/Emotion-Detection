from flask import Flask, send_from_directory, render_template
import os

# Initialize Flask app
app = Flask(__name__, template_folder='./frontend', static_folder='./frontend')

# Route for the main HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Route to serve static files like CSS, JS, and assets in the frontend folder
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('./frontend', filename)

# Route to serve files from the backend folder
@app.route('/backend/<path:filename>')
def backend_files(filename):
    # Path to the backend folder relative to this script
    script_dir = os.path.dirname(__file__)
    backend_folder = os.path.join(script_dir, "backend")
    if not os.path.exists(backend_folder):
        return f"Backend folder not found: {backend_folder}", 404
    return send_from_directory(backend_folder, filename)

if __name__ == '__main__':
    # Start the Flask server in debug mode
    app.run(debug=True)

  #TODO: Update this class to the new backend changes + 
  # unclicking function of the barchart + hover color change bug
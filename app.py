import os
from flask import Flask, render_template, send_from_directory

app = Flask(__name__, template_folder='./frontend')

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

if __name__ == '__main__':
    app.run(debug=True)
    
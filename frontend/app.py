from flask import Flask, send_from_directory, render_template

app = Flask(__name__, template_folder='.')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/backend/<path:filename>')
def backend_files(filename):
    return send_from_directory('../backend', filename)

if __name__ == '__main__':
    app.run(debug=True)

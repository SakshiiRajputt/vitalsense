"""
VitalSense – Full server entry point
Serves the Flask API on port 5000 AND the static frontend files.
Run: python server.py
"""

import os
import sys

# Ensure backend module is importable
sys.path.insert(0, os.path.dirname(__file__))

from flask import send_from_directory
from app import app, db

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

@app.route("/")
def index():
    return send_from_directory(os.path.join(FRONTEND_DIR, "templates"), "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "static"), filename)

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    print("\n🩺  VitalSense is running → http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)

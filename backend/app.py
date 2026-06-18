"""
Health Prediction Application - Backend
Flask + SQLite + Google Gemini AI for health risk prediction
"""

import os
import re
from datetime import date, datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv

load_dotenv()  # reads .env file into environment variables

# App setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "patients.db")

app = Flask(__name__, static_folder=None)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
CORS(app)

db = SQLAlchemy(app)

# Google Gemini client – reads GEMINI_API_KEY from environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

_gemini_client = None
def get_gemini_client():
    """Lazily create the Gemini client so app startup never depends on network access."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


# Database model
class Patient(db.Model):
    __tablename__ = "patients"

    id           = db.Column(db.Integer, primary_key=True)
    full_name    = db.Column(db.String(120), nullable=False)
    date_of_birth= db.Column(db.String(10),  nullable=False)   # ISO: YYYY-MM-DD
    email        = db.Column(db.String(120), nullable=False, unique=True)
    glucose      = db.Column(db.Float, nullable=False)
    haemoglobin  = db.Column(db.Float, nullable=False)
    cholesterol  = db.Column(db.Float, nullable=False)
    remarks      = db.Column(db.Text, default="")
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":            self.id,
            "full_name":     self.full_name,
            "date_of_birth": self.date_of_birth,
            "email":         self.email,
            "glucose":       self.glucose,
            "haemoglobin":   self.haemoglobin,
            "cholesterol":   self.cholesterol,
            "remarks":       self.remarks,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
        }


# Validation helpers
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def validate_patient(data: dict, updating: bool = False) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors = []
    required = ["full_name", "date_of_birth", "email", "glucose", "haemoglobin", "cholesterol"]

    if not updating:
        for field in required:
            if field not in data or str(data[field]).strip() == "":
                errors.append(f"'{field}' is required.")

    # Name
    name = data.get("full_name", "").strip()
    if name and len(name) < 2:
        errors.append("Full name must be at least 2 characters.")

    # Date of birth
    dob_str = data.get("date_of_birth", "")
    if dob_str:
        try:
            dob = date.fromisoformat(dob_str)
            if dob >= date.today():
                errors.append("Date of birth cannot be today or a future date.")
        except ValueError:
            errors.append("Date of birth must be in YYYY-MM-DD format.")

    # Email
    email = data.get("email", "").strip()
    if email and not EMAIL_RE.match(email):
        errors.append("Email address is not valid.")

    # Numeric blood values
    for field, label, lo, hi in [
        ("glucose",     "Glucose",     0.1, 600),
        ("haemoglobin", "Haemoglobin", 0.1, 25),
        ("cholesterol", "Cholesterol", 0.1, 800),
    ]:
        val = data.get(field)
        if val is not None:
            try:
                fval = float(val)
                if fval <= 0:
                    errors.append(f"{label} must be a positive number.")
                elif not (lo <= fval <= hi):
                    errors.append(f"{label} value {fval} seems outside the plausible range ({lo}–{hi}).")
            except (TypeError, ValueError):
                errors.append(f"{label} must be a numeric value.")

    return errors


# AI prediction
def generate_health_prediction(patient: Patient) -> str:
    """
    Call Google Gemini to generate a concise health risk assessment
    based on the patient's blood-test values.
    """
    prompt = f"""You are a clinical decision-support assistant. Analyse the following patient blood test results and provide a concise health risk assessment (2-4 sentences). 
Mention any likely conditions suggested by the values, severity level (Low / Moderate / High risk), and one actionable recommendation. 
Do NOT provide a definitive diagnosis. Keep the tone professional and empathetic.

Patient details:
- Full Name: {patient.full_name}
- Date of Birth: {patient.date_of_birth}
- Glucose: {patient.glucose} mg/dL
- Haemoglobin: {patient.haemoglobin} g/dL
- Cholesterol: {patient.cholesterol} mg/dL

Respond with just the health assessment paragraph—no headers, no bullet points."""

    if not GEMINI_API_KEY:
        return "AI prediction unavailable: GEMINI_API_KEY is not set."

    response = get_gemini_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            http_options=genai_types.HttpOptions(timeout=20_000),  # ms
        ),
    )
    return response.text.strip()


# Routes

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Health Predict API is running"})


# CREATE
@app.route("/api/patients", methods=["POST"])
def create_patient():
    data = request.get_json(silent=True) or {}
    errors = validate_patient(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    # Check duplicate email
    if Patient.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"success": False, "errors": ["A patient with this email already exists."]}), 409

    patient = Patient(
        full_name    = data["full_name"].strip(),
        date_of_birth= data["date_of_birth"],
        email        = data["email"].strip().lower(),
        glucose      = float(data["glucose"]),
        haemoglobin  = float(data["haemoglobin"]),
        cholesterol  = float(data["cholesterol"]),
    )
    db.session.add(patient)
    db.session.flush()          # get auto-ID before AI call

    # AI prediction
    try:
        patient.remarks = generate_health_prediction(patient)
    except Exception as exc:
        patient.remarks = f"AI prediction unavailable: {exc}"

    db.session.commit()
    return jsonify({"success": True, "patient": patient.to_dict()}), 201


# READ ALL
@app.route("/api/patients", methods=["GET"])
def list_patients():
    patients = Patient.query.order_by(Patient.created_at.desc()).all()
    return jsonify({"success": True, "patients": [p.to_dict() for p in patients]})


# READ ONE
@app.route("/api/patients/<int:patient_id>", methods=["GET"])
def get_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    return jsonify({"success": True, "patient": patient.to_dict()})


# UPDATE
@app.route("/api/patients/<int:patient_id>", methods=["PUT"])
def update_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    data = request.get_json(silent=True) or {}
    errors = validate_patient(data, updating=True)
    if errors:
        return jsonify({"success": False, "errors": errors}), 422

    # Check email uniqueness (skip own record)
    new_email = data.get("email", "").strip().lower()
    if new_email and new_email != patient.email:
        if Patient.query.filter_by(email=new_email).first():
            return jsonify({"success": False, "errors": ["Another patient already uses this email."]}), 409

    updatable = ["full_name", "date_of_birth", "email", "glucose", "haemoglobin", "cholesterol"]
    for field in updatable:
        if field in data:
            val = data[field]
            if field == "email":
                val = val.strip().lower()
            elif field == "full_name":
                val = val.strip()
            elif field in ("glucose", "haemoglobin", "cholesterol"):
                val = float(val)
            setattr(patient, field, val)

    patient.updated_at = datetime.utcnow()

    # Re-generate AI prediction when blood values change
    blood_fields = {"glucose", "haemoglobin", "cholesterol"}
    if blood_fields.intersection(data.keys()):
        try:
            patient.remarks = generate_health_prediction(patient)
        except Exception as exc:
            patient.remarks = f"AI prediction unavailable: {exc}"

    db.session.commit()
    return jsonify({"success": True, "patient": patient.to_dict()})


# DELETE
@app.route("/api/patients/<int:patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    db.session.delete(patient)
    db.session.commit()
    return jsonify({"success": True, "message": f"Patient {patient_id} deleted."})


# RE-GENERATE AI REMARKS (utility endpoint)
@app.route("/api/patients/<int:patient_id>/predict", methods=["POST"])
def regenerate_prediction(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    try:
        patient.remarks = generate_health_prediction(patient)
        db.session.commit()
        return jsonify({"success": True, "remarks": patient.remarks})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# Bootstrap DB & run
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)

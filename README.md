# VitalSense – AI Health Prediction Application

A full-stack health prediction application that collects patient blood-test results and uses **Google Gemini AI** to generate personalised health risk assessments.

---

## Tech Stack

| Layer      | Technology                        | Reason chosen |
|------------|-----------------------------------|---------------|
| Backend    | **Python / Flask**                | Lightweight, rapid API development, excellent AI SDK support |
| Database   | **SQLite + SQLAlchemy ORM**       | Zero-config persistent storage, perfect for a self-contained app |
| AI/ML      | **Google Gemini (gemini-2.5-flash)**     | Free, generous rate-limited tier with no credit card required; strong medical text reasoning |
| Frontend   | **Vanilla HTML/CSS/JS**           | No build step, fast, full control over design; served by Flask |

---

## Features

- **Full CRUD** – Create, Read, Update, Delete patient records
- **Data validation** – Name, DOB (no future dates), email format, numeric blood values with range checks
- **AI remarks** – Auto-generated health risk assessment (Low / Moderate / High) on every save
- **Risk colour coding** – Blood values highlighted red/amber/green against clinical thresholds
- **Live search** – Filter by name or email instantly
- **Stats dashboard** – Total patients and risk distribution at a glance
- **Persistent storage** – SQLite database survives restarts

---

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/vitalsense.git
cd vitalsense
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

Get a **free** API key (no credit card required) at https://aistudio.google.com/app/apikey

### 5. Run the server
```bash
python backend/server.py
```

Open **http://127.0.0.1:5000** in your browser.

---

## API Endpoints

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/health`                     | Health check                       |
| GET    | `/api/patients`                   | List all patients                  |
| POST   | `/api/patients`                   | Create patient + AI prediction     |
| GET    | `/api/patients/:id`               | Get single patient                 |
| PUT    | `/api/patients/:id`               | Update patient (re-runs AI)        |
| DELETE | `/api/patients/:id`               | Delete patient                     |
| POST   | `/api/patients/:id/predict`       | Re-generate AI remarks             |

---

## Blood Value Reference Ranges

| Metric       | Normal Range          | Unit   |
|--------------|-----------------------|--------|
| Glucose      | 70 – 99               | mg/dL  |
| Haemoglobin  | 12 – 17.5             | g/dL   |
| Cholesterol  | < 200                 | mg/dL  |

---

## Project Structure

```
vitalsense/
├── backend/
│   ├── app.py          # Flask app, SQLAlchemy models, routes, AI integration
│   └── server.py       # Entry point – serves API + static frontend
├── frontend/
│   ├── templates/
│   │   └── index.html  # Single-page app shell
│   └── static/
│       ├── css/style.css
│       └── js/app.js
├── requirements.txt
├── .env.example        # Environment variable template (no secrets)
├── .gitignore
└── README.md
```

---

## Security Notes

- All secrets (API keys) are loaded from `.env` which is excluded from version control via `.gitignore`
- The `.env.example` file contains only placeholder values
- Patient emails are stored in lowercase and checked for uniqueness
- No patient data is sent externally except to the Google Gemini API for health assessment generation

---

## AI Integration Detail

When a patient is created or their blood values are updated, the backend calls Google's `gemini-2.5-flash` model with a structured prompt containing the patient's values. The model returns a 2–4 sentence clinical decision-support paragraph that:

- Identifies possible health conditions suggested by the values
- States the overall risk level (Low / Moderate / High)
- Provides one actionable recommendation
- Emphasises this is decision support, not a diagnosis

---

## License

MIT

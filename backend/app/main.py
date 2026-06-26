from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
from dotenv import load_dotenv
import os
import sys

# Add backend to path for imports
backend_root = os.path.dirname(os.path.dirname(__file__))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Load environment variables from backend/.env regardless of current working directory
load_dotenv(os.path.join(backend_root, ".env"))

# Initializam Firebase o singura data aici (optional for development)
try:
    firebase_key_path = os.path.join(backend_root, "firebase_key.json")
    if os.path.exists(firebase_key_path):
        cred = credentials.Certificate(firebase_key_path)
        firebase_admin.initialize_app(cred)
    else:
        print("⚠️  Firebase key not found - running in test mode")
except Exception as e:
    print(f"⚠️  Firebase initialization failed: {e} - running in test mode")

from app.routes.vocabulary import router as vocabulary_router
from app.routes.auth import router as auth_router
from app.routes.accent import router as accent_router
from app.routes.shadow import router as shadow_router
from app.routes.adaptive import router as adaptive_router
from app.routes.assessment import router as assessment_router
from app.routes.research_assessment import router as research_router
from app.routes.srs import router as srs_router
from app.routes.health import router as health_router
from app.routes.practice import router as practice_router
from app.routes.cefr_predict import router as cefr_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
        "exp://localhost:8081",
        "exp://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Transcribed", "X-Response", "X-Audio-Available"],
)

app.include_router(vocabulary_router, prefix="/vocabulary")
app.include_router(auth_router, prefix="/auth")
app.include_router(accent_router, prefix="/accent")
app.include_router(shadow_router, prefix="/shadow")
app.include_router(adaptive_router, prefix="/adaptive")
app.include_router(assessment_router, prefix="/assessment")
app.include_router(research_router)  # Includes /assessment/* routes for research modules
app.include_router(srs_router, prefix="/srs")
app.include_router(health_router)  # /health and /health/cache/clear
app.include_router(practice_router)  # /practice/adaptive, word-retention, reading, listening
app.include_router(cefr_router, prefix="/cefr")  # /cefr/predict, /cefr/features (Ordinal LR + SVM, written Kaggle corpus)

@app.on_event("startup")
async def on_startup():
    """Pre-warm the vocabulary bank cache and auto-seed Firestore if empty."""
    try:
        from app.services.vocabulary_coach import _get_vocabulary_bank
        bank = _get_vocabulary_bank()
        print(f"✅ Vocabulary bank ready: {len(bank)} words")
    except Exception as e:
        print(f"⚠️  Vocabulary bank init failed: {e}")


@app.get("/")
def root():
    return {"status": "VocaFlow API running"}
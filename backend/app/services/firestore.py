from firebase_admin import firestore
from datetime import datetime

# Initialize Firestore at module level
db = firestore.client()

def get_db():
    return db


def delete_user_progress(user_id: str) -> dict:
    """Delete all of a user's practice/assessment data from Firestore so
    'Reset progress' actually sticks (sessions are otherwise re-hydrated from the
    cloud). Keeps the account + onboarding profile. Returns deletion counts."""
    database = get_db()
    deleted = {"sessions": 0, "assessments": 0}

    # 1) Practice sessions (vocabulary / accent / shadow all live here)
    for doc in database.collection("sessions").where("user_id", "==", user_id).stream():
        doc.reference.delete()
        deleted["sessions"] += 1

    # 2) Assessment history (initial diagnostic runs)
    try:
        hist = database.collection("assessments").document(user_id).collection("history")
        for doc in hist.stream():
            doc.reference.delete()
            deleted["assessments"] += 1
    except Exception:
        pass

    return deleted

def save_vocabulary_session(user_id: str, original_text: str, improved_text: str, suggestions: list) -> str:
    db = get_db()
    session = {
        "user_id": user_id,
        "type": "vocabulary",
        "original_text": original_text,
        "improved_text": improved_text,
        "suggestions_count": len(suggestions),
        "suggestions": suggestions,
        "created_at": datetime.utcnow().isoformat(),
    }
    doc_ref = db.collection("sessions").add(session)
    return doc_ref[1].id

def save_accent_session(user_id: str, target_word: str, transcribed: str, score: int, phonemes: list) -> str:
    db = get_db()
    session = {
        "user_id": user_id,
        "type": "accent",
        "target_word": target_word,
        "transcribed_text": transcribed,
        "accuracy_score": score,
        "problematic_phonemes": phonemes,
        "created_at": datetime.utcnow().isoformat(),
    }
    doc_ref = db.collection("sessions").add(session)
    return doc_ref[1].id

def get_user_sessions(user_id: str) -> list:
    db = get_db()
    sessions = db.collection("sessions")\
        .where("user_id", "==", user_id)\
        .order_by("created_at", direction=firestore.Query.DESCENDING)\
        .limit(100)\
        .stream()
    return [{"id": s.id, **s.to_dict()} for s in sessions]
def save_shadow_session(
    user_id: str,
    original_text: str,
    transcribed: str,
    score: int,
    *,
    wpm: int = 0,
    word_accuracy: int = 0,
    phoneme_score: int | None = None,
    pause_count: int = 0,
    pause_rate_per_min: float = 0.0,
    fluency_label: str = "unknown",
    genre: str = "_default",
    duration_s: float = 0.0,
) -> str:
    """
    Persist a shadow speaking session with full metrics for progress tracking.

    Extended fields (added for trend analysis):
      wpm, word_accuracy, phoneme_score, pause_count, pause_rate_per_min,
      fluency_label, genre, duration_s.
    """
    db = get_db()
    session = {
        "user_id":            user_id,
        "type":               "shadow",
        "original_text":      original_text,
        "transcribed_text":   transcribed,
        "accuracy_score":     score,
        "wpm":                wpm,
        "word_accuracy":      word_accuracy,
        "phoneme_score":      phoneme_score,
        "pause_count":        pause_count,
        "pause_rate_per_min": pause_rate_per_min,
        "fluency_label":      fluency_label,
        "genre":              genre,
        "duration_s":         duration_s,
        "created_at":         datetime.utcnow().isoformat(),
    }
    doc_ref = db.collection("sessions").add(session)
    return doc_ref[1].id


def get_shadow_sessions(user_id: str, limit: int = 30) -> list:
    """
    Return shadow speaking sessions for a user, ordered by created_at descending.
    Type filter applied in Python to avoid a composite Firestore index requirement.
    """
    db = get_db()
    docs = (
        db.collection("sessions")
        .where("user_id", "==", user_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit * 3)   # fetch extra to compensate for type filtering
        .stream()
    )
    result = []
    for s in docs:
        d = s.to_dict()
        if d.get("type") == "shadow":
            result.append({"id": s.id, **d})
            if len(result) >= limit:
                break
    return result

def save_speaking_session(user_id: str, session_data: dict) -> str:
    db = get_db()
    session = {
        "user_id": user_id,
        "type": "speaking",
        "created_at": datetime.utcnow().isoformat(),
        **session_data,
    }
    doc_ref = db.collection("sessions").add(session)
    return doc_ref[1].id

def get_speaking_sessions(user_id: str, limit: int = 50) -> list:
    """
    Return sessions of type 'speaking' for a user, ordered by created_at desc.
    These are the sessions saved by save_speaking_session (vocabulary analyses).
    Type filter applied in Python to avoid requiring a composite Firestore index.
    """
    db = get_db()
    sessions = (
        db.collection("sessions")
        .where("user_id", "==", user_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit * 2)  # fetch extra to account for filtering
        .stream()
    )
    result = []
    for s in sessions:
        d = s.to_dict()
        if d.get("type") == "speaking":
            result.append({"id": s.id, **d})
            if len(result) >= limit:
                break
    return result


def save_assessment(user_id: str, assessment_data: dict) -> str:
    """Persist a diagnostic assessment snapshot to Firestore (subcollection per user)."""
    db = get_db()
    doc = {
        "user_id": user_id,
        "ts": int(datetime.utcnow().timestamp() * 1000),   # ms — matches frontend convention
        "created_at": datetime.utcnow().isoformat(),
        **assessment_data,
    }
    _, ref = db.collection("assessments").document(user_id).collection("history").add(doc)
    return ref.id


def get_assessments(user_id: str, limit: int = 30) -> list:
    """Return assessment history for a user, newest first."""
    db = get_db()
    docs = (
        db.collection("assessments")
        .document(user_id)
        .collection("history")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def save_learner_profile(user_id: str, profile_data: dict) -> None:
    """Save learner adaptive profile to Firestore."""
    db = get_db()
    profile_data["updated_at"] = datetime.utcnow().isoformat()
    db.collection("learner_profiles").document(user_id).set(profile_data, merge=True)

def get_learner_profile(user_id: str) -> dict:
    """Retrieve learner adaptive profile from Firestore."""
    db = get_db()
    doc = db.collection("learner_profiles").document(user_id).get()
    if doc.exists:
        return doc.to_dict()
    return None
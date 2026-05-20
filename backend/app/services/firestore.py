from firebase_admin import firestore
from datetime import datetime

# Initialize Firestore at module level
db = firestore.client()

def get_db():
    return db

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
        .limit(20)\
        .stream()
    return [{"id": s.id, **s.to_dict()} for s in sessions]
def save_shadow_session(user_id: str, original_text: str, transcribed: str, score: int) -> str:
    db = get_db()
    session = {
        "user_id": user_id,
        "type": "shadow",
        "original_text": original_text,
        "transcribed_text": transcribed,
        "accuracy_score": score,
        "created_at": datetime.utcnow().isoformat(),
    }
    doc_ref = db.collection("sessions").add(session)
    return doc_ref[1].id

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
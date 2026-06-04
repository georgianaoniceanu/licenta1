import logging
from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from app.services.accent_dna import (
    transcribe_audio,
    analyze_pronunciation,
    build_phoneme_result,
    ROMANIAN_PRONUNCIATION_PATTERNS,
    COARTICULATION_RULES
)
from app.services.phoneme_remote import assess_pronunciation
from app.services.firestore import save_accent_session
from app.services.auth import verify_token
from app.services.tts import text_to_speech
from app.services.exercises import get_all_exercises, get_exercise_by_id
from fastapi.responses import Response
import tempfile
import os

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/romanian-patterns")
async def get_romanian_patterns():
    """Get Măchiță (2021) Romanian learner pronunciation patterns"""
    return {
        "source": "Măchiță, O.-M. (2021). The Acquisition of English Phonology by Romanian Learners",
        "patterns": ROMANIAN_PRONUNCIATION_PATTERNS,
        "coarticulation_rules": COARTICULATION_RULES
    }

@router.get("/phoneme/{phoneme}")
async def get_phoneme_details(phoneme: str):
    """Get detailed pattern for specific problematic phoneme"""
    # Handle different formats
    search_key = phoneme if phoneme in ROMANIAN_PRONUNCIATION_PATTERNS else None
    
    if not search_key:
        for key in ROMANIAN_PRONUNCIATION_PATTERNS.keys():
            if phoneme.lower() in key.lower():
                search_key = key
                break
    
    if not search_key:
        raise HTTPException(status_code=404, detail=f"Phoneme pattern not found for: {phoneme}")
    
    return {
        "phoneme": search_key,
        **ROMANIAN_PRONUNCIATION_PATTERNS[search_key]
    }

@router.get("/exercises")
async def get_exercises():
    return {"exercises": get_all_exercises()}

@router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str):
    exercise = get_exercise_by_id(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise

@router.get("/speak/{exercise_id}")
async def speak_exercise(exercise_id: str):
    exercise = get_exercise_by_id(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    audio_bytes = text_to_speech(exercise["sentence"])
    return Response(content=audio_bytes, media_type="audio/mpeg")

@router.post("/analyze")
async def analyze_accent(
    audio: UploadFile = File(...),
    target_text: str = Form(...),
    authorization: str = Header(None)
):
    """Analyze pronunciation with Romanian learner patterns from Măchiță"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 1) Whisper ASR — always runs (needed for word accuracy + phoneme text input)
        transcribed = transcribe_audio(tmp_path)

        # 2) Phoneme scoring — always succeeds (Tier 1: local CMU-dict PER;
        #    Tier 2: Colab wav2vec2 if COLAB_PHONEME_URL is set and healthy).
        phoneme_result = assess_pronunciation(tmp_path, target_text, transcribed)
        result = build_phoneme_result(phoneme_result, target_text)
        result["transcribed_text"] = transcribed
        result["phoneme_engine"] = phoneme_result.get("engine", "local-cmudict-per")

        if authorization and authorization.startswith("Bearer "):
            try:
                token = authorization.replace("Bearer ", "")
                user = verify_token(token)
                save_accent_session(
                    user_id=user["uid"],
                    target_word=target_text,
                    transcribed=transcribed,
                    score=result["accuracy_score"],
                    phonemes=result.get("problematic_phonemes", [])
                )
            except Exception as _save_err:
                logger.warning("Could not save accent session: %s", _save_err)

        return result

    finally:
        os.unlink(tmp_path)
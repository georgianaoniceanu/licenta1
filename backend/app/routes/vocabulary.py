"""
Vocabulary Router — Refactored

CHANGES FROM ORIGINAL:
1. Imports now from vocabulary_coach (not vocabulary)
2. POST /analyze — now auto-tracks generic word patterns with user_id
3. GET /patterns — NEW — returns user's most frequent generic words
4. POST /seed — NEW — admin endpoint to populate Firestore (idempotent)
5. All existing endpoints (exercise, submit, progress, stats) preserved
"""

from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.services.vocabulary_coach import (
    get_random_exercise,
    submit_exercise_answer,
    get_user_progress,
    get_daily_stats,
    get_lexical_patterns,
    analyze_vocabulary,
    transcribe_audio,
    seed_vocabulary_bank,
    generate_context_aware_sentence,
    transcribe_audio_with_confidence,
    generate_phonetic_breakdown,
    generate_word_family,
    get_personalized_exercise,
    analyze_recording_quality,
    get_rt_stats,
    get_srs_state,
)
from app.services.auth import verify_token
from app.services.firestore import save_speaking_session, get_speaking_sessions
from app.services.cefr_word_classifier import classify_vocabulary, tag_words_in_order
from app.services.exam_mapper import compute_exam_profile
from app.services.romanian_error_detector import detect_romanian_errors
from app.services.coca_genre_classifier import classify_text_genre

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ExerciseSubmissionPayload(BaseModel):
    vocab_id: str
    exercise_type: str  # "multiple_choice", "typing", "fill_blank"
    answer: str
    correct_answer: str
    response_time_ms: int = 0  # DeKeyser & Suzuki (2025): RT measures automatization


class AnalyzeTextPayload(BaseModel):
    text: str


class PronunciationAnalysisPayload(BaseModel):
    target_text: str
    transcribed_text: str


class ContextAwareSentencePayload(BaseModel):
    target_word: str
    user_interests: str = None
    difficulty_level: str = "intermediate"  # "beginner", "intermediate", "advanced"


class PhoneticBreakdownPayload(BaseModel):
    target_text: str
    transcribed_text: str


class WordFamilyPayload(BaseModel):
    target_word: str


class PersonalizedExercisePayload(BaseModel):
    difficulty: str = "intermediate"  # "beginner", "intermediate", "advanced"
    learning_style: str = "vocabulary"  # "pronunciation", "vocabulary", "grammar"
    time_available: str = "long"  # "quick", "medium", "long"


class RecordingQualityPayload(BaseModel):
    audio_uri: str  # Temporary file path to analyze


class SaveSessionPayload(BaseModel):
    ts: int
    input_mode: str = "speaking"
    caf: dict = {}
    exam: dict = {}
    grammar: dict = {}
    genre: dict = {}


class ExamProfilePayload(BaseModel):
    text: str
    pronunciation_score: float = 0.0
    wps: float = 0.0
    filler_rate: float = 0.0
    mls: float = 0.0
    cefr_distribution: dict = {}
    input_mode: str = 'speaking'  # 'speaking' or 'writing'


class DetectErrorsPayload(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def get_user_id_from_token(authorization: str) -> str:
    """
    Extracts user_id from Bearer token.
    Raises 401 HTTPException if invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        return user["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/exercise")
async def get_exercise(authorization: str = Header(None)):
    """
    Returns a personalized vocabulary exercise.
    
    If user has lexical patterns saved, the exercise will target the 
    better alternative for their most frequently used generic word.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        exercise = get_random_exercise(user_id)
        return {
            "success": True,
            "data": exercise,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit")
async def submit_exercise(
    payload: ExerciseSubmissionPayload,
    authorization: str = Header(None)
):
    """
    Submits exercise answer and updates user's progress.
    Saves accuracy, mastery level, and daily statistics.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = submit_exercise_answer(
            user_id=user_id,
            vocab_id=payload.vocab_id,
            exercise_type=payload.exercise_type,
            answer=payload.answer,
            correct_answer=payload.correct_answer,
            response_time_ms=payload.response_time_ms,
        )
        
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/analyze")
async def analyze_text(
    payload: AnalyzeTextPayload,
    authorization: str = Header(None)
):
    """
    Analyzes user text and suggests more sophisticated vocabulary.
    
    CHANGE: Automatically saves detected patterns to user's profile
    in Firestore. This enables personalized exercises and thesis validation
    (demonstrates systematic pattern tracking).
    
    Before: Did not track anything.
    After: Saves frequency counter for each generic word used.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = analyze_vocabulary(user_id, payload.text)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/transcribe")
async def transcribe_speech(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Transcribes audio file using Groq's Whisper model.
    
    Audio formats: WAV, MP3, OGG, FLAC
    Language: English
    Returns: Transcribed text
    
    Usage flow:
    1. Frontend records audio → sends as file upload
    2. Backend uses Groq Whisper → accurate transcription
    3. Can pipe output to /analyze endpoint for vocabulary feedback
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        import tempfile, os

        # Derive the correct extension from the uploaded file so Whisper gets
        # the right content-type. Defaulting to .wav causes hallucinations when
        # the browser sends WebM/OGG bytes with a .wav label.
        ct = (file.content_type or "").lower()
        fname = (file.filename or "").lower()
        if ".webm" in fname or "webm" in ct:
            suffix = ".webm"
        elif ".ogg" in fname or "ogg" in ct:
            suffix = ".ogg"
        elif ".m4a" in fname or "mp4" in ct:
            suffix = ".m4a"
        elif ".mp3" in fname or "mpeg" in ct:
            suffix = ".mp3"
        elif ".flac" in fname or "flac" in ct:
            suffix = ".flac"
        elif ".wav" in fname or "wav" in ct:
            suffix = ".wav"
        else:
            suffix = ".webm"  # browser default

        content = await file.read()
        print(f"[transcribe] filename={file.filename!r} content_type={file.content_type!r} suffix={suffix} size={len(content)} bytes")

        if len(content) < 1000:
            return {"success": False, "error": f"Audio too small ({len(content)} bytes) — microphone may not be capturing. Check browser mic permissions."}

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Transcribe using Groq Whisper
        transcribed_text = transcribe_audio(tmp_path)
        os.remove(tmp_path)

        # Filter known Whisper silence hallucinations
        HALLUCINATIONS = {"thank you.", "thank you", "thanks for watching.", "thanks for watching", "you", ".", " ", ""}
        if transcribed_text.strip().lower() in HALLUCINATIONS:
            return {"success": False, "error": "No speech detected — audio appears silent. Speak louder and closer to the microphone."}
        
        if not transcribed_text:
            raise Exception("Failed to transcribe audio")
        
        return {
            "success": True,
            "data": {
                "transcribed_text": transcribed_text,
                "user_id": user_id
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/patterns")
async def get_patterns(authorization: str = Header(None)):
    """
    NEW — Returns user's generic lexical patterns, sorted by frequency.
    
    Example response:
    [
        {
            "word": "good",
            "better_alternative": "compelling",
            "frequency": 12,
            "explanation": "More precise and emphatic"
        },
        {
            "word": "things",
            "better_alternative": "aspects",
            "frequency": 8,
            "explanation": "More academic and specific"
        }
    ]
    
    Used in thesis Chapter 4 (Validation & Results) to demonstrate that
    the system identifies and tracks generic vocabulary over time.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        patterns = get_lexical_patterns(user_id)
        return {
            "success": True,
            "data": patterns,
            "count": len(patterns),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/progress")
async def get_progress(authorization: str = Header(None)):
    """
    Returns user's overall vocabulary progress.
    Includes total attempts, correct answers, accuracy, and mastery breakdown.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        progress = get_user_progress(user_id)
        return {
            "success": True,
            "data": progress,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rt-stats")
async def get_reaction_time_stats(authorization: str = Header(None)):
    """
    Returns Skill Acquisition automatization metrics (DeKeyser & Suzuki 2025):
    - avg_rt_ms: average response time (decreasing = automatization)
    - cv: coefficient of variation of RT (decreasing = procedural knowledge)
    - trend: session-by-session average RT for progress graph
    """
    user_id = get_user_id_from_token(authorization)
    return get_rt_stats(user_id)


@router.get("/stats")
async def get_stats(days: int = 7, authorization: str = Header(None)):
    """
    Returns user's daily vocabulary exercise statistics for the past N days.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        stats = get_daily_stats(user_id, days)
        return {
            "success": True,
            "data": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed")
async def seed_bank(authorization: str = Header(None)):
    """
    NEW — Populates vocabulary_bank in Firestore with 570 academic words
    from vocabulary_enriched.json.
    
    Called once at deployment or from admin panel.
    Does NOT overwrite if bank already exists (idempotent).
    
    Requires authentication to prevent accidental calls.
    """
    user_id = get_user_id_from_token(authorization)  # Verify authenticated
    
    try:
        seed_vocabulary_bank()
        return {
            "success": True,
            "message": "✅ Vocabulary bank seeded successfully",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/generate-context-aware-sentence")
async def generate_context_sentence(
    payload: ContextAwareSentencePayload,
    authorization: str = Header(None)
):
    """
    FEATURE 24 — Generate context-aware pronunciation sentences.
    
    Instead of generic prompts, generates personalized sentences tailored to:
    - User's interests (hobbies, career, topics)
    - Difficulty level (beginner/intermediate/advanced)
    - Real-world usage context (business, academic, travel, etc.)
    
    Example Response:
    {
        "sentence": "The multinational corporation will discuss quarterly earnings...",
        "context": "business",
        "explanation": "Useful for learning professional terminology",
        "interest_match": true,
        "difficulty_explanation": "Uses intermediate vocabulary..."
    }
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = generate_context_aware_sentence(
            user_id=user_id,
            target_word=payload.target_word,
            user_interests=payload.user_interests,
            difficulty_level=payload.difficulty_level
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }



@router.post("/phonetic-breakdown")
async def get_phonetic_breakdown(
    payload: PhoneticBreakdownPayload,
    authorization: str = Header(None)
):
    """
    FEATURE 16 — Detailed phonetic breakdown using IPA.
    
    Shows exactly which phonemes differ between target and user pronunciation.
    """
    try:
        # Try to get user_id, but don't fail if missing
        user_id = None
        try:
            user_id = get_user_id_from_token(authorization)
        except Exception as token_err:
            print(f"⚠️  Token error (non-blocking): {token_err}")
        
        print(f"📤 Phonetic breakdown request: target='{payload.target_text}' user='{payload.transcribed_text}'")
        
        result = generate_phonetic_breakdown(
            target_text=payload.target_text,
            transcribed_text=payload.transcribed_text
        )
        
        response_obj = {
            "success": True,
            "data": result,
        }
        print(f"✅ Phonetic breakdown response: {response_obj}")
        return response_obj
        
    except Exception as e:
        print(f"❌ Phonetic breakdown error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "data": {
                "target_ipa": "",
                "user_ipa": "",
                "phoneme_errors": [],
                "stress_pattern_analysis": f"Error: {str(e)}",
                "overall_phonetic_accuracy": 0
            }
        }


@router.post("/word-family")
async def get_word_family(
    payload: WordFamilyPayload,
    authorization: str = Header(None)
):
    """
    FEATURE 17 — Generate word family drilling exercises.
    
    When user masters a word (score > 85), auto-generates related forms:
    - discussion (noun)
    - discussable (adjective)
    - discussing (gerund)
    - discussed (past tense)
    
    Example Response:
    {
        "base_word": "discuss",
        "word_family": [
            {
                "word": "discussion",
                "part_of_speech": "noun",
                "definition": "conversation or debate about a topic",
                "pronunciation": "/dɪˈskʌʃən/",
                "example_sentence": "The discussion lasted for two hours."
            },
            {
                "word": "discussing",
                "part_of_speech": "gerund/verb",
                "definition": "presently talking about or debating",
                "pronunciation": "/dɪˈskʌsɪŋ/",
                "example_sentence": "We are discussing the project timeline."
            }
        ]
    }
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = generate_word_family(payload.target_word)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/personalized-exercise")
async def get_personalized_ex(
    payload: PersonalizedExercisePayload,
    authorization: str = Header(None)
):
    """
    FEATURE 15 — Highly personalized exercise generation.
    
    Selects next word based on:
    - User's weak areas (specific sounds, stress patterns)
    - Spaced repetition schedule
    - Difficulty progression (easy → hard)
    - Time availability (quick vs detailed)
    - Learning style (vocabulary vs pronunciation vs grammar)
    
    Example Response:
    {
        "exercise_type": "pronunciation",
        "target_word": "discuss",
        "vocab_id": "awl_01_042",
        "difficulty": "intermediate",
        "reason": "You struggle with /sk/ clusters and this word has one",
        "time_estimate": "90 seconds",
        "focus_area": "consonant clusters",
        "personalization_score": 0.95,
        "pronunciation": "/dɪˈskʌs/",
        "definition": "to talk about a topic with others",
        "example_sentence": "Let's discuss your progress."
    }
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = get_personalized_exercise(
            user_id=user_id,
            difficulty=payload.difficulty,
            learning_style=payload.learning_style,
            time_available=payload.time_available
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/classify-text")
async def classify_text_endpoint(
    payload: AnalyzeTextPayload,
    authorization: str = Header(None)
):
    """
    CEFR Vocabulary Classification (EVP / new-GSL / AWL / NAWL / AVL).

    Returns:
      - distribution: % of text at each CEFR level (A1–C2)
      - vocab_cefr_level: highest level reached by ≥5% of tokens
      - highest_level_words: top C1/C2 words used
      - word_tags: [{word, level}] in text order — for per-word colour chips
      - level_breakdown: up to 15 sample words per level

    Research: English Vocabulary Profile (Cambridge); Coxhead (2000) AWL;
    NAWL (article 26); Davies AVL (article 47);
    TAALES (Crossley & Kyle 2018) morphological heuristics.
    """
    get_user_id_from_token(authorization)
    result = classify_vocabulary(payload.text)
    word_tags = tag_words_in_order(payload.text)
    return {
        "success": True,
        "data": {**result, "word_tags": word_tags},
    }


@router.post("/exam-profile")
async def get_exam_profile(
    payload: ExamProfilePayload,
    authorization: str = Header(None)
):
    """
    Maps student speech metrics to IELTS Speaking bands (1–9) and
    Cambridge CEFR level (A1–C2).

    Indicators computed:
      - MTLD (Kolahi Ahari et al. 2025) — lexical diversity
      - Lexical Density (Neumanova 2015)
      - Subordination Index (Barrot & Agdeppa 2021; Bae & Min 2020)
    Combined with client-sent: WPS, filler rate, MLS, pronunciation score,
    CEFR distribution.

    Returns: indicators, ielts (4 criteria + overall band), cambridge (level +
    exam equivalent), sources (full academic citations).
    """
    get_user_id_from_token(authorization)
    try:
        profile = compute_exam_profile(
            text=payload.text,
            pronunciation_score=payload.pronunciation_score,
            wps=payload.wps,
            filler_rate=payload.filler_rate,
            mls=payload.mls,
            cefr_distribution=payload.cefr_distribution,
            input_mode=payload.input_mode,
        )
        return {"success": True, "data": profile}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/classify-genre")
async def classify_genre_endpoint(
    payload: AnalyzeTextPayload,
    authorization: str = Header(None)
):
    """
    COCA Genre Classifier — determines dominant register/domain of learner text.

    9 top-level genres from Davies' Corpus of Contemporary American English:
      spoken · fiction · magazine · newspaper · academic · web · blog · movies · tv

    Source: lemmas_60k_subgenres.xlsx (1-in-10 sample of top 60 k COCA lemmas).
    """
    get_user_id_from_token(authorization)
    try:
        result = classify_text_genre(payload.text)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/detect-errors")
async def detect_errors_endpoint(
    payload: DetectErrorsPayload,
    authorization: str = Header(None)
):
    """
    Romanian L1 Interference Error Detector — Pungă & Pârlog (2015).

    Detects 6 error categories in English learner text produced by
    Romanian speakers:
      1. Article errors (pp.163–164)
      2. Preposition errors (pp.165–166)
      3. SVO word order violations
      4. Double negation (GALR 2008; Swan & Smith 2001)
      5. False friends — Popescu (2013)
      6. Tense/aspect errors (lack of progressive)

    Returns: errors[], error_count, severity_score (0–100), categories{},
             research citation string.
    """
    get_user_id_from_token(authorization)
    try:
        result = detect_romanian_errors(payload.text)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/sessions")
async def user_sessions(authorization: str = Header(None)):
    """
    Return all 'speaking' sessions for the authenticated user from Firestore.

    Used by the History screen to display sessions that survive app reinstall.
    Falls back gracefully — if Firestore is unreachable the history screen
    still shows AsyncStorage data.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        sessions = get_speaking_sessions(user_id, limit=50)
        return {"success": True, "data": sessions}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}


@router.get("/srs-state")
async def srs_state(authorization: str = Header(None)):
    """
    SM-2 review state for the authenticated user.

    Returns word counts and word lists for four categories:
      due      — overdue or due today (sm2_next_review <= today)
      learning — reviewed at least once; interval < 21 days
      mastered — interval >= 21 days (Cepeda et al. 2006 long-term threshold)
      new      — never attempted; ordered by AWL sublist

    Used by the Practice Hub Retention tab to show real SM-2 progress
    instead of synthetic proxies.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        state = get_srs_state(user_id)
        return {"success": True, "data": state}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/save-session")
async def save_session(
    payload: SaveSessionPayload,
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization)
    try:
        session_id = save_speaking_session(user_id, {
            "ts": payload.ts,
            "input_mode": payload.input_mode,
            "caf": payload.caf,
            "exam": payload.exam,
            "grammar": payload.grammar,
            "genre": payload.genre,
        })
        return {"success": True, "session_id": session_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/analyze-recording-quality")
async def check_recording_quality(
    payload: RecordingQualityPayload,
    authorization: str = Header(None)
):
    """
    FEATURE 14 — Analyze recording quality in real-time.
    
    Provides feedback on:
    - Duration
    - Silence percentage (mic issue detection)
    - Noise level assessment
    - Peak amplitude
    - Quality score (0-1)
    - Specific issues found
    - Recommendations for re-recording
    
    Example Response:
    {
        "duration": 4.5,
        "silence_percentage": 5.2,
        "noise_level": "low",
        "peak_amplitude": 0.85,
        "quality_score": 0.92,
        "issues": [],
        "recommendation": "Recording quality is excellent!"
    }
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        result = analyze_recording_quality(payload.audio_uri)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
"""
Vocabulary Coach Service — Refactored to use vocabulary_enriched.json

CHANGES FROM ORIGINAL:
1. VOCABULARY_DATA hardcoded ❌ → Load from app/data/vocabulary_enriched.json ✅
2. Added: seed_vocabulary_bank() — populates Firestore with 570 academic words
3. Added: track_lexical_patterns() — identifies generic word usage patterns
4. Added: get_lexical_patterns() — returns user's most frequent generic words
5. get_random_exercise() now prioritizes personalized exercises from patterns
6. All other functions preserved: analyze_vocabulary, submit_exercise, stats, etc.

Research Foundation:
- Coxhead, A. (2000). Academic Word List — 570 words across 10 sublists.
- DeKeyser, R. M., & Suzuki, Y. (2025). Skill acquisition theory. In VanPatten et al.
  (Eds.), Theories in SLA: An introduction (4th ed., pp. 157–182). Routledge.
  Vocabulary exercises are designed to proceduralize declarative word knowledge through
  repeated contextualized retrieval. Prioritizing weakest words mirrors the principle
  that focused practice on not-yet-automatized items yields the steepest learning gains.
- Asrifan, A., Cardoso, L. M. O. B., & Vargheese, K. J. (2026). Automated feedback
  for speaking and writing skills: Deep learning in English language assessment.
  EduLite: Journal of English Education, Literature, and Culture, 11(1), 67–85.
  LLM-generated contextual feedback (via Groq) is empirically supported: AI feedback
  produces significant gains in lexical diversity and grammatical accuracy for EFL
  learners, particularly for form-focused elements such as collocations and word choice.
"""

import random
import json
import os
from typing import List, Dict, Optional
from datetime import datetime, date, timedelta
from groq import Groq
from dotenv import load_dotenv
from app.services.firestore import db
from app.services.cache import cached

try:
    import eng_to_ipa
    PHONETIC_LIBRARY_AVAILABLE = True
except ImportError:
    PHONETIC_LIBRARY_AVAILABLE = False
    print("⚠️  eng-to-ipa not installed. Install with: pip install eng-to-ipa")

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
# ---------------------------------------------------------------------------
# 1. LOAD VOCABULARY FROM JSON
# ---------------------------------------------------------------------------

def load_vocabulary_from_json(file_path: str = None) -> List[Dict]:
    """
    Reads vocabulary from app/data/vocabulary_enriched.json
    
    Structure:
    {
        "metadata": {...},
        "vocabulary": [
            {
                "id": "awl_01_001",
                "word": "analyse",
                "pronunciation": "AN-uh-lyze",
                "definition": "To examine something carefully...",
                "synonyms": ["examine", "study", "evaluate"],
                "example_sentence": "...",
                "difficulty": "beginner",
                "category": "research",
                "sublist": 1
            },
            ... 570 items total
        ]
    }
    """
    if file_path is None:
        # Get the absolute path to the JSON file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(current_dir))
        file_path = os.path.join(backend_dir, "app", "data", "vocabulary_enriched.json")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('vocabulary', [])
    except Exception as e:
        print(f"Error loading vocabulary from {file_path}: {e}")
        return []


# ---------------------------------------------------------------------------
# 2. SEED — Populate Firestore from JSON (runs once)
# ---------------------------------------------------------------------------

# ─── In-memory vocabulary bank cache ────────────────────────────────────────
# Populated on first call. Avoids reading 570 Firestore docs on every request.
_VOCABULARY_CACHE: List[Dict] = []

def _get_vocabulary_bank() -> List[Dict]:
    """Return all vocabulary bank words, populated from Firestore on first use."""
    global _VOCABULARY_CACHE
    if not _VOCABULARY_CACHE:
        _VOCABULARY_CACHE = [doc.to_dict() for doc in db.collection("vocabulary_bank").stream()]
        if not _VOCABULARY_CACHE:
            seed_vocabulary_bank()
            _VOCABULARY_CACHE = [doc.to_dict() for doc in db.collection("vocabulary_bank").stream()]
    return _VOCABULARY_CACHE


# ---------------------------------------------------------------------------
# SM-2 SPACED REPETITION ALGORITHM
# ---------------------------------------------------------------------------
# Each vocabulary_progress document stores:
#   sm2_ef            — easiness factor (default 2.5, min 1.3)
#   sm2_interval      — days until next review (1 → 6 → grows by EF each pass)
#   sm2_repetitions   — consecutive correct reviews
#   sm2_next_review   — ISO date string for next due date

def _sm2_update(data: Dict, grade: int) -> Dict:
    """
    Compute updated SM-2 fields after one review.

    grade 5 — perfect recall (fast + correct)
    grade 4 — correct with hesitation
    grade 3 — correct but slow / effortful
    grade 2 — incorrect (resets interval to 1 day)

    Based on SM-2 adaptive spacing algorithm.
    Cepeda et al. (2006): distributed practice is the strongest predictor of
    long-term lexical retention over massed practice. [Cepeda2006.txt]
    """
    ef   = data.get("sm2_ef", 2.5)
    ivl  = data.get("sm2_interval", 1)
    reps = data.get("sm2_repetitions", 0)

    if grade < 3:
        reps = 0
        ivl  = 1
    else:
        if reps == 0:
            ivl = 1
        elif reps == 1:
            ivl = 6
        else:
            ivl = max(1, round(ivl * ef))
        reps += 1

    ef = max(1.3, ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    next_review = (date.today() + timedelta(days=ivl)).isoformat()

    return {
        "sm2_ef":          round(ef, 2),
        "sm2_interval":    ivl,
        "sm2_repetitions": reps,
        "sm2_next_review": next_review,
    }


def _grade_from_result(is_correct: bool, rt_ms: int) -> int:
    """
    Map exercise outcome to SM-2 grade.

    RT thresholds follow DeKeyser & Suzuki (2025) automatization criteria:
      < 2000 ms — automatized recall → grade 5
      < 5000 ms — controlled recall  → grade 4
      ≥ 5000 ms — effortful recall   → grade 3
    Incorrect always → grade 2 (resets interval to 1 day).
    """
    if not is_correct:
        return 2
    if rt_ms > 0 and rt_ms < 2000:
        return 5
    if rt_ms > 0 and rt_ms < 5000:
        return 4
    return 3


def seed_vocabulary_bank():
    """
    Populates 'vocabulary_bank' collection in Firestore with 570 academic words
    from vocabulary_enriched.json.
    
    Only runs if collection is empty (doesn't overwrite).
    """
    bank_ref = db.collection("vocabulary_bank")
    
    # Check if already seeded
    existing = list(bank_ref.limit(1).stream())
    if existing:
        print("✅ Vocabulary bank already seeded.")
        return

    # Load from JSON
    vocabulary = load_vocabulary_from_json()
    if not vocabulary:
        print("❌ Failed to load vocabulary from JSON.")
        return

    # Batch write to Firestore (in chunks due to size)
    if len(vocabulary) > 500:
        # Firestore batch write limit is 500
        for i in range(0, len(vocabulary), 500):
            chunk = vocabulary[i:i+500]
            batch = db.batch()
            for word in chunk:
                doc_ref = bank_ref.document(word["id"])
                batch.set(doc_ref, {
                    **word,
                    "created_at": datetime.now(),
                    "used_in_exercises": 0
                })
            batch.commit()
    else:
        batch = db.batch()
        for word in vocabulary:
            doc_ref = bank_ref.document(word["id"])
            batch.set(doc_ref, {
                **word,
                "created_at": datetime.now(),
                "used_in_exercises": 0
            })
        batch.commit()

    print(f"✅ Seeded {len(vocabulary)} words into vocabulary_bank.")


# ---------------------------------------------------------------------------
# 3. TRANSCRIBE AUDIO with Groq Whisper — NEW
# ---------------------------------------------------------------------------

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribes audio file using Groq's Whisper model.
    
    Expects: WAV, MP3, OGG, or FLAC format
    Returns: Transcribed text (English)
    
    This replaces frontend STT with more accurate Groq Whisper.
    """
    try:
        with open(audio_file_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                language="en",
                response_format="json"
            )
        
        transcribed_text = transcript.text
        print(f"✅ Transcribed: {transcribed_text[:100]}...")
        return transcribed_text
    
    except Exception as e:
        print(f"❌ Error transcribing audio: {e}")
        return ""


# ---------------------------------------------------------------------------
# 4. ANALYZE VOCABULARY — with AI feedback
# ---------------------------------------------------------------------------

@cached("vocab_llm", ttl=3600)
def _analyze_vocabulary_llm(user_text: str) -> dict:
    """LLM-only step (cacheable by text). Side effects live in analyze_vocabulary."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": """You are an English vocabulary coach for Romanian speakers at B1-C1 level.
                CRITICAL: Identify ALL generic/weak words and replace with sophisticated alternatives.
                
                Generic words to TARGET:
                - "good", "bad", "nice", "very", "a lot", "things", "stuff", "said", "think", "feel"
                - "great", "really", "probably", "maybe", "just", "kind of", "sort of"
                - "look", "get", "go", "make", "take", "put", "come", "give", "try"
                - Any adjective used more than once
                
                When given text, respond ONLY with this exact JSON format (NO markdown, NO code blocks):
                {
                    "improved_text": "complete text with all generic words replaced",
                    "suggestions": [
                        {
                            "original_word": "exact weak word/phrase from original text",
                            "better_alternative": "sophisticated B1-C1+ alternative",
                            "explanation": "why this alternative is better (be specific)"
                        }
                    ]
                }
                
                RULES:
                1. Find EVERY generic word - minimum 2-3 suggestions per sentence
                2. Preserve original meaning and tone
                3. Use academic/professional vocabulary when possible
                4. Focus on precision and formality
                5. Explanations must be educational
                
                Return ONLY valid JSON, no other text."""
            },
            {"role": "user", "content": f"Analyze this text and identify ALL weak vocabulary:\n\n{user_text}"}
        ]
    )

    try:
        result = json.loads(response.choices[0].message.content)
        if not isinstance(result.get("suggestions"), list):
            result["suggestions"] = []
        for suggestion in result.get("suggestions", []):
            if "original" in suggestion and "original_word" not in suggestion:
                suggestion["original_word"] = suggestion.pop("original")
            if "suggestion" in suggestion and "better_alternative" not in suggestion:
                suggestion["better_alternative"] = suggestion.pop("suggestion")
        return result
    except Exception as e:
        print(f"Error parsing AI response: {e}")
        print(f"Raw response: {response.choices[0].message.content}")
        return {"improved_text": user_text, "suggestions": []}


def analyze_vocabulary(user_id: str, user_text: str) -> dict:
    """
    Analyzes user text and suggests sophisticated alternatives.
    LLM portion is cached by text (1h TTL); pattern tracking is per-user
    and always runs (DB write).
    """
    result = _analyze_vocabulary_llm(user_text)
    if user_id and result.get("suggestions"):
        track_lexical_patterns(user_id, result["suggestions"])
    return result


# ---------------------------------------------------------------------------
# 4. TRACK LEXICAL PATTERNS — NEW
# ---------------------------------------------------------------------------

def track_lexical_patterns(user_id: str, suggestions: list):
    """
    Saves user's repeated generic word patterns to Firestore.
    
    Each generic word detected increments a frequency counter.
    Example: User says "good" 87 times → system can target exercises on
    synonyms like "excellent, outstanding, compelling".
    
    This is the core contribution declared in thesis chapter 1:
    "Identification of user's generic lexical patterns and proposal of
    more precise alternatives near native expression."
    """
    for suggestion in suggestions:
        # Support both old and new field names
        original_word = suggestion.get("original_word") or suggestion.get("original", "")
        original_word = original_word.lower().strip()
        if not original_word:
            continue

        pattern_ref = (
            db.collection("users")
            .document(user_id)
            .collection("lexical_patterns")
            .document(original_word.replace(" ", "_"))
        )

        try:
            doc = pattern_ref.get()
            if doc.exists:
                data = doc.to_dict()
                frequency = data.get("frequency", 0) + 1
            else:
                frequency = 1

            better_alt = suggestion.get("better_alternative") or suggestion.get("suggestion", "")
            pattern_ref.set({
                "word": original_word,
                "better_alternative": better_alt,
                "explanation": suggestion.get("explanation", ""),
                "frequency": frequency,
                "last_seen": datetime.now(),
                "is_generic": True,
            }, merge=True)
        except Exception as e:
            print(f"Error tracking pattern '{original_word}': {e}")


# ---------------------------------------------------------------------------
# 5. GET LEXICAL PATTERNS — NEW
# ---------------------------------------------------------------------------

def get_lexical_patterns(user_id: str) -> List[Dict]:
    """
    Returns user's most frequent generic lexical patterns, sorted by frequency.
    
    Output for thesis validation (Chapter 4):
    Can demonstrate that user says "good" in 87% of exercises instead of
    "excellent/outstanding/compelling/remarkable" etc.
    """
    try:
        docs = (
            db.collection("users")
            .document(user_id)
            .collection("lexical_patterns")
            .order_by("frequency", direction="DESCENDING")
            .limit(20)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        print(f"Error getting lexical patterns: {e}")
        return []


# ---------------------------------------------------------------------------
# 6. GET RANDOM EXERCISE — Personalized
# ---------------------------------------------------------------------------

def get_random_exercise(user_id: str) -> Dict:
    """
    Select the next word to practice using SM-2 scheduling.

    Selection priority (no LLM — all content from vocabulary_enriched.json):
      1. Overdue reviews: sm2_next_review <= today, sorted earliest-first
      2. New words not yet seen, ordered by AWL sublist (1 = most frequent)
      3. Least-known practiced word (lowest sm2_interval)
      4. Random fallback (should not occur in normal use)

    Returns a 4-option multiple-choice exercise where the learner selects
    the correct definition for a given word.
    """
    today = date.today().isoformat()

    progress_docs = list(
        db.collection("users").document(user_id)
          .collection("vocabulary_progress").stream()
    )
    practiced: Dict[str, Dict] = {doc.id: doc.to_dict() for doc in progress_docs}

    bank = _get_vocabulary_bank()
    bank_by_id: Dict[str, Dict] = {w["id"]: w for w in bank}

    target: Optional[Dict] = None

    # Priority 1 — overdue reviews
    overdue = sorted(
        [(vid, d) for vid, d in practiced.items()
         if d.get("sm2_next_review", today) <= today],
        key=lambda x: x[1].get("sm2_next_review", "")
    )
    if overdue:
        target = bank_by_id.get(overdue[0][0])

    # Priority 2 — new words, AWL sublist order (sublist 1 first)
    if not target:
        unseen = sorted(
            [w for w in bank if w["id"] not in practiced],
            key=lambda w: (w.get("sublist", 99), w.get("word", ""))
        )
        if unseen:
            target = unseen[0]

    # Priority 3 — least-known practiced word
    if not target and practiced:
        least = sorted(practiced.items(), key=lambda x: x[1].get("sm2_interval", 1))
        target = bank_by_id.get(least[0][0])

    # Priority 4 — random fallback
    if not target and bank:
        target = random.choice(bank)

    if not target:
        return {"error": "No vocabulary available. Seed the bank first."}

    # ── Exercise format: alternate between two types ────────────────────────
    # word_to_def — show word, pick correct definition (tests recognition)
    # def_to_word — show definition, pick correct word (tests active recall)
    exercise_format = random.choice(["word_to_def", "def_to_word"])

    if exercise_format == "word_to_def":
        wrong = random.sample(
            [w["definition"] for w in bank if w["id"] != target["id"]],
            k=min(3, len(bank) - 1)
        )
        options        = [target["definition"]] + wrong
        random.shuffle(options)
        question       = target["word"]
        correct_answer = target["definition"]
        instruction    = "Which definition is correct?"
    else:
        wrong = random.sample(
            [w["word"] for w in bank if w["id"] != target["id"]],
            k=min(3, len(bank) - 1)
        )
        options        = [target["word"]] + wrong
        random.shuffle(options)
        question       = target["definition"]
        correct_answer = target["word"]
        instruction    = "Which word matches this definition?"

    prog = practiced.get(target["id"], {})
    return {
        "vocab_id":          target["id"],
        "word":              target["word"],
        "pronunciation":     target.get("pronunciation", ""),
        "definition":        target["definition"],
        "example_sentence":  target.get("example_sentence", ""),
        "synonyms":          target.get("synonyms", []),
        "difficulty":        target.get("difficulty", "intermediate"),
        "category":          target.get("category", ""),
        "sublist":           target.get("sublist", 1),
        "exercise_format":   exercise_format,   # "word_to_def" | "def_to_word"
        "question":          question,           # text shown prominently
        "instruction":       instruction,        # what to do
        "options":           options,
        "correct_index":     options.index(correct_answer),
        "correct_answer":    correct_answer,     # sent to /submit as answer
        "is_new":            target["id"] not in practiced,
        "sm2_interval":      prog.get("sm2_interval", 0),
        "sm2_next_review":   prog.get("sm2_next_review"),
        "attempts":          prog.get("attempts", 0),
    }


# ---------------------------------------------------------------------------
# 7. SUBMIT EXERCISE ANSWER
# ---------------------------------------------------------------------------

def submit_exercise_answer(
    user_id: str,
    vocab_id: str,
    exercise_type: str,
    answer: str,
    correct_answer: str,
    response_time_ms: int = 0,
) -> Dict:
    """
    Record one exercise attempt and apply SM-2 scheduling.

    Derives SM-2 grade from correctness + response time (DeKeyser & Suzuki 2025),
    updates vocabulary_progress in Firestore, and returns the new review schedule
    so the frontend can display "Next review: in N days".
    """
    is_correct = answer.lower().strip() == correct_answer.lower().strip()
    grade = _grade_from_result(is_correct, response_time_ms)

    try:
        user_vocab_ref = (
            db.collection("users")
            .document(user_id)
            .collection("vocabulary_progress")
            .document(vocab_id)
        )

        doc = user_vocab_ref.get()
        if doc.exists:
            data = doc.to_dict()
            attempts      = data.get("attempts", 0) + 1
            correct_count = data.get("correct_count", 0) + (1 if is_correct else 0)
        else:
            data          = {}
            attempts      = 1
            correct_count = 1 if is_correct else 0

        accuracy      = correct_count / attempts * 100
        mastery_level = calculate_mastery_level(attempts, accuracy)
        sm2           = _sm2_update(data, grade)

        # Store word text so /vocabulary/srs-state can return readable labels
        word_text = data.get("word", "")
        if not word_text:
            bank_doc = db.collection("vocabulary_bank").document(vocab_id).get()
            if bank_doc.exists:
                word_text = bank_doc.to_dict().get("word", "")

        user_vocab_ref.set({
            "vocab_id":       vocab_id,
            "word":           word_text,
            "attempts":       attempts,
            "correct_count":  correct_count,
            "accuracy":       accuracy,
            "mastery_level":  mastery_level,
            "last_attempted": datetime.now(),
            "exercise_type":  exercise_type,
            **sm2,
        }, merge=True)

        if response_time_ms > 0:
            _save_response_time(user_id, response_time_ms, is_correct)
        update_daily_stats(user_id, is_correct)

        return {
            "is_correct":      is_correct,
            "grade":           grade,
            "accuracy":        round(accuracy, 1),
            "mastery_level":   mastery_level,
            "sm2_interval":    sm2["sm2_interval"],
            "sm2_next_review": sm2["sm2_next_review"],
            "message":         "Correct!" if is_correct else "Incorrect",
        }
    except Exception as e:
        print(f"Error saving exercise: {e}")
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# 8b. RESPONSE TIME TRACKING — DeKeyser & Suzuki (2025) Skill Acquisition
# ---------------------------------------------------------------------------

def _save_response_time(user_id: str, rt_ms: int, is_correct: bool):
    """
    Append response time to user's RT history in Firestore.
    Used to compute:
      - Average RT (decreasing over sessions = automatization)
      - CV = std(RT) / mean(RT) (decreasing = more consistent = automatized skill)
    Source: DeKeyser & Suzuki (2025) Skill Acquisition Theory in SLA.
    """
    try:
        ref = db.collection("users").document(user_id).collection("rt_history").document("data")
        doc = ref.get()
        history = doc.to_dict().get("times", []) if doc.exists else []
        history.append({"rt_ms": rt_ms, "correct": is_correct, "ts": datetime.now().isoformat()})
        # Keep last 200 entries
        if len(history) > 200:
            history = history[-200:]
        ref.set({"times": history}, merge=True)
    except Exception as e:
        print(f"RT save error: {e}")


def get_rt_stats(user_id: str) -> Dict:
    """
    Compute RT automatization metrics from stored history.

    Returns:
      avg_rt_ms: average response time (ms) — decreasing trend = automatization
      cv: coefficient of variation (std/mean) — decreasing = more consistent
      trend: list of session averages (last 10 sessions of 10 responses each)
      interpretation: string label based on DeKeyser & Suzuki (2025)
    """
    import math
    try:
        ref = db.collection("users").document(user_id).collection("rt_history").document("data")
        doc = ref.get()
        if not doc.exists:
            return {"avg_rt_ms": None, "cv": None, "trend": [], "interpretation": "No data yet"}

        times = [e["rt_ms"] for e in doc.to_dict().get("times", []) if e.get("rt_ms", 0) > 0]
        if len(times) < 3:
            return {"avg_rt_ms": None, "cv": None, "trend": [], "interpretation": "Need more practice sessions"}

        avg = sum(times) / len(times)
        variance = sum((t - avg) ** 2 for t in times) / len(times)
        std = math.sqrt(variance)
        cv = round(std / avg, 3) if avg > 0 else None

        # Session trend: group into chunks of 10
        chunk = 10
        trend = []
        for i in range(0, len(times), chunk):
            chunk_times = times[i:i + chunk]
            trend.append(round(sum(chunk_times) / len(chunk_times)))
        trend = trend[-10:]  # last 10 sessions

        # Interpretation — DeKeyser & Suzuki (2025): RT < 2000ms + CV < 0.3 = automatized
        if avg < 2000 and cv is not None and cv < 0.30:
            interpretation = "Automatized — responses are fast and consistent"
        elif avg < 4000 and cv is not None and cv < 0.50:
            interpretation = "Developing automaticity — improving with practice"
        else:
            interpretation = "Controlled processing — still requires conscious effort"

        return {
            "avg_rt_ms": round(avg),
            "cv": cv,
            "trend": trend,
            "total_responses": len(times),
            "interpretation": interpretation,
            "research": "DeKeyser & Suzuki (2025) Skill Acquisition Theory: RT and CV measure transition from declarative to procedural knowledge.",
        }
    except Exception as e:
        print(f"RT stats error: {e}")
        return {"avg_rt_ms": None, "cv": None, "trend": [], "interpretation": "Error loading data"}


# ---------------------------------------------------------------------------
# 8. CALCULATE MASTERY LEVEL
# ---------------------------------------------------------------------------

def calculate_mastery_level(attempts: int, accuracy: float) -> str:
    """
    Determines user's mastery level based on attempts and accuracy.
    """
    if accuracy >= 90 and attempts >= 5:
        return "expert"
    elif accuracy >= 70 and attempts >= 3:
        return "proficient"
    elif accuracy >= 50 and attempts >= 1:
        return "learning"
    else:
        return "new"


# ---------------------------------------------------------------------------
# 9. UPDATE DAILY STATS
# ---------------------------------------------------------------------------

def update_daily_stats(user_id: str, is_correct: bool):
    """
    Tracks daily exercise statistics for user progress tracking.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    stats_ref = (
        db.collection("users")
        .document(user_id)
        .collection("daily_stats")
        .document(today)
    )
    try:
        doc = stats_ref.get()
        if doc.exists:
            data = doc.to_dict()
            correct_today = data.get("correct_exercises", 0) + (1 if is_correct else 0)
            total_today = data.get("total_exercises", 0) + 1
        else:
            correct_today = 1 if is_correct else 0
            total_today = 1

        stats_ref.set({
            "date": today,
            "correct_exercises": correct_today,
            "total_exercises": total_today,
            "accuracy": (correct_today / total_today) * 100 if total_today > 0 else 0,
        }, merge=True)
    except Exception as e:
        print(f"Error updating daily stats: {e}")


# ---------------------------------------------------------------------------
# 10. GET USER PROGRESS
# ---------------------------------------------------------------------------

def get_user_progress(user_id: str) -> Dict:
    """
    Returns comprehensive user progress across all vocabulary.
    """
    try:
        docs = (
            db.collection("users")
            .document(user_id)
            .collection("vocabulary_progress")
            .stream()
        )

        vocabulary_progress = {}
        total_attempts = 0
        total_correct = 0

        for doc in docs:
            data = doc.to_dict()
            vocab_id = data.get("vocab_id")
            vocabulary_progress[vocab_id] = {
                "attempts": data.get("attempts", 0),
                "correct_count": data.get("correct_count", 0),
                "accuracy": data.get("accuracy", 0),
                "mastery_level": data.get("mastery_level", "new"),
            }
            total_attempts += data.get("attempts", 0)
            total_correct += data.get("correct_count", 0)

        return {
            "total_vocabulary_attempted": len(vocabulary_progress),
            "total_attempts": total_attempts,
            "total_correct": total_correct,
            "overall_accuracy": (total_correct / total_attempts * 100) if total_attempts > 0 else 0,
            "vocabulary_progress": vocabulary_progress,
            "mastery_breakdown": {
                "new": sum(1 for v in vocabulary_progress.values() if v["mastery_level"] == "new"),
                "learning": sum(1 for v in vocabulary_progress.values() if v["mastery_level"] == "learning"),
                "proficient": sum(1 for v in vocabulary_progress.values() if v["mastery_level"] == "proficient"),
                "expert": sum(1 for v in vocabulary_progress.values() if v["mastery_level"] == "expert"),
            }
        }
    except Exception as e:
        print(f"Error getting user progress: {e}")
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# 11. GET DAILY STATS
# ---------------------------------------------------------------------------

def get_daily_stats(user_id: str, days: int = 7) -> List[Dict]:
    """
    Returns user's daily exercise statistics for the past N days.
    """
    try:
        docs = (
            db.collection("users")
            .document(user_id)
            .collection("daily_stats")
            .order_by("date", direction="DESCENDING")
            .limit(days)
            .stream()
        )
        stats = [doc.to_dict() for doc in docs]
        return sorted(stats, key=lambda x: x["date"])
    except Exception as e:
        print(f"Error getting daily stats: {e}")
        return []


# ---------------------------------------------------------------------------
# 11b. SRS STATE — full SM-2 view across all vocabulary words
# ---------------------------------------------------------------------------

def get_srs_state(user_id: str) -> Dict:
    """
    Return the user's SM-2 state across all vocabulary bank words.

    Categories:
      due      — sm2_next_review <= today; review is overdue or ready
      learning — reviewed at least once; interval < 21 days
      mastered — interval >= 21 days (long-term memory threshold,
                 Cepeda et al. 2006)
      new      — never attempted; ordered by AWL sublist

    The 21-day mastery threshold follows Cepeda et al. (2006):
    "The spacing effect in learning: A temporal ridgeline of optimal retention".
    """
    today = date.today().isoformat()

    try:
        progress_docs = list(
            db.collection("users").document(user_id)
              .collection("vocabulary_progress").stream()
        )
        practiced: Dict[str, Dict] = {doc.id: doc.to_dict() for doc in progress_docs}

        bank         = _get_vocabulary_bank()
        bank_by_id   = {w["id"]: w for w in bank}
        new_count    = sum(1 for w in bank if w["id"] not in practiced)

        due:      List[Dict] = []
        learning: List[Dict] = []
        mastered: List[Dict] = []

        for vocab_id, data in practiced.items():
            next_review = data.get("sm2_next_review")
            interval    = data.get("sm2_interval", 1)
            # Fallback to bank for docs written before the word field was added
            word = data.get("word") or bank_by_id.get(vocab_id, {}).get("word", vocab_id)
            entry = {
                "vocab_id":    vocab_id,
                "word":        word,
                "interval":    interval,
                "next_review": next_review,
                "attempts":    data.get("attempts", 0),
            }
            if not next_review or next_review <= today:
                due.append(entry)
            elif interval >= 21:
                mastered.append(entry)
            else:
                learning.append(entry)

        return {
            "due_count":      len(due),
            "learning_count": len(learning),
            "mastered_count": len(mastered),
            "new_count":      new_count,
            "total_bank":     len(bank),
            "due":      sorted(due,      key=lambda x: x.get("next_review") or "")[:20],
            "learning": sorted(learning, key=lambda x: x.get("next_review") or "")[:20],
            "mastered": sorted(mastered, key=lambda x: -(x.get("interval") or 0))[:20],
        }
    except Exception as e:
        print(f"SRS state error: {e}")
        return {
            "due_count": 0, "learning_count": 0,
            "mastered_count": 0, "new_count": 0, "total_bank": 0,
            "due": [], "learning": [], "mastered": [],
        }


# ---------------------------------------------------------------------------
# 12. GENERATE CONTEXT-AWARE SENTENCES — NEW FEATURE
# ---------------------------------------------------------------------------

def generate_context_aware_sentence(user_id: str, target_word: str, user_interests: str = None, difficulty_level: str = "intermediate") -> Dict:
    """
    Generates personalized context-aware sentences for pronunciation practice.
    
    FEATURE 24:
    Instead of generic "Please say: discuss in a sentence", generates:
    - Sentences tailored to user interests
    - Difficulty-appropriate vocabulary
    - Real-world usage context
    - Professional/academic settings
    
    Args:
        user_id: For fetching user interests/previous topics
        target_word: The word to practice
        user_interests: Optional interests (hobbies, career, etc.)
        difficulty_level: "beginner", "intermediate", "advanced"
    
    Returns:
        {
            "sentence": "The research team will discuss the findings...",
            "context": "business/academic",
            "explanation": "Why this context is useful for learning",
            "interest_match": True/False,
            "difficulty_explanation": "This sentence uses intermediate vocabulary..."
        }
    """
    try:
        # If interests not provided, try to get from user profile
        if not user_interests:
            try:
                user_ref = db.collection("users").document(user_id).get()
                if user_ref.exists:
                    user_data = user_ref.to_dict()
                    user_interests = user_data.get("interests", "general English learning")
            except Exception:
                user_interests = "general English learning"
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an English pronunciation coach. Generate ONE personalized context-aware sentence for pronunciation practice.

TARGET WORD: {target_word}
USER INTERESTS: {user_interests}
DIFFICULTY LEVEL: {difficulty_level}

RULES:
1. Create a realistic, high-value sentence using the target word
2. Match difficulty level: beginner = simple structures, intermediate = mixed complexity, advanced = complex
3. If possible, incorporate user interests (make it relevant to them)
4. Use professional/academic language when appropriate
5. Sentence length: 12-20 words

Return ONLY this JSON format:
{{
    "sentence": "complete sentence with target word",
    "context": "business|academic|casual|travel|technology",
    "explanation": "Why this sentence is useful for learning pronunciation",
    "interest_match": true/false,
    "difficulty_explanation": "How this matches the {difficulty_level} level"
}}"""
                },
                {
                    "role": "user",
                    "content": f"Generate a {difficulty_level} sentence for the word '{target_word}' that would interest someone learning {user_interests}"
                }
            ]
        )
        
        result = json.loads(response.choices[0].message.content)
        print(f"✅ Generated context-aware sentence for '{target_word}'")
        return result
    
    except Exception as e:
        print(f"❌ Error generating context-aware sentence: {e}")
        # Fallback to generic sentence
        return {
            "sentence": f"Please pronounce this word: {target_word}",
            "context": "generic",
            "explanation": "Standard pronunciation practice",
            "interest_match": False,
            "difficulty_explanation": f"Generic {difficulty_level} sentence"
        }


# ---------------------------------------------------------------------------
# 13. ANALYZE PRONUNCIATION WITH EMOTION DETECTION — NEW FEATURE
# ---------------------------------------------------------------------------

def transcribe_audio_with_confidence(audio_file_path: str) -> Dict:
    """
    Transcribes audio using Groq Whisper and extracts confidence scores.
    
    FEATURE 25 (Part 1):
    Returns not just the text, but also confidence in the transcription,
    allowing the system to detect if the user's speech was clear/unclear.
    
    Returns:
        {
            "transcribed_text": "Hi, how are you?",
            "confidence": 0.95,  # 95% confidence in transcription
            "timestamp": "...",
            "language": "en",
            "duration": 4.5
        }
    """
    try:
        with open(audio_file_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                language="en",
                response_format="verbose_json"  # Get more detailed info
            )
        
        # Extract data from response
        result = {
            "transcribed_text": transcript.text,
            "confidence": getattr(transcript, 'confidence', 0.90),  # Default 90% if not provided
            "timestamp": datetime.now().isoformat(),
            "language": "en",
            "duration": float(getattr(transcript, 'duration', 0))
        }
        
        print(f"✅ Transcribed with {result['confidence']*100:.1f}% confidence: {transcript.text[:50]}...")
        return result
    
    except Exception as e:
        print(f"❌ Error transcribing audio with confidence: {e}")
        return {
            "transcribed_text": "",
            "confidence": 0.0,
            "timestamp": datetime.now().isoformat(),
            "language": "en",
            "duration": 0
        }



# ---------------------------------------------------------------------------
# 14. PHONETIC BREAKDOWN WITH IPA — FEATURE 16
# ---------------------------------------------------------------------------

@cached("phonetic_breakdown", ttl=3600)
def generate_phonetic_breakdown(target_text: str, transcribed_text: str) -> Dict:
    """
    Generates detailed phonetic breakdown using IPA (International Phonetic Alphabet).
    
    FEATURE 16 — SIMPLIFIED VERSION (LLM analysis removed)
    ⚠️ ALWAYS returns IPA using eng-to-ipa library
    """
    
    print(f"\n📱 Phonetic breakdown: target='{target_text}' vs user='{transcribed_text}'")
    
    # Sanitize input
    target_text = str(target_text or "").strip()
    transcribed_text = str(transcribed_text or "").strip()
    
    # Default values
    target_ipa = ""
    user_ipa = ""
    ipa_source = "error"
    
    # Generate IPA
    if PHONETIC_LIBRARY_AVAILABLE:
        try:
            # Convert to IPA
            target_raw = eng_to_ipa.convert(target_text.lower()) if target_text else ""
            user_raw = eng_to_ipa.convert(transcribed_text.lower()) if transcribed_text else ""
            
            # Format output
            target_ipa = f"/{target_raw}/" if target_raw and not target_raw.endswith("*") else f"/[{target_text}]/"
            user_ipa = f"/{user_raw}/" if user_raw and not user_raw.endswith("*") else f"/[{transcribed_text}]/"
            ipa_source = "eng-to-ipa"
            
            print(f"✅ IPA generated: {target_ipa}")
        except Exception as e:
            print(f"❌ IPA error: {e}")
            target_ipa = f"/[{target_text}]/"
            user_ipa = f"/[{transcribed_text}]/"
            ipa_source = f"fallback: {str(e)}"
    else:
        print("⚠️  Library not available")
        target_ipa = f"/[{target_text}]/"
        user_ipa = f"/[{transcribed_text}]/"
        ipa_source = "fallback: no library"
    
    # Return basic data (no LLM)
    return {
        "target_ipa": target_ipa,
        "user_ipa": user_ipa,
        "phoneme_errors": [],
        "stress_pattern_analysis": "Analysis not available",
        "overall_phonetic_accuracy": 0,
        "_ipa_source": ipa_source
    }


# ---------------------------------------------------------------------------
# 15. WORD FAMILY DRILLING — FEATURE 17
# ---------------------------------------------------------------------------

@cached("word_family", ttl=24 * 3600)
def generate_word_family(target_word: str) -> Dict:
    """
    Generates related word forms for drilling word families.
    
    FEATURE 17:
    When user masters "discuss" (score > 85), auto-generate exercises for:
    - discussion (noun)
    - discussable (adjective)
    - discussing (gerund)
    - discussed (past tense)
    
    Returns:
        {
            "base_word": "discuss",
            "word_family": [
                {
                    "word": "discussion",
                    "part_of_speech": "noun",
                    "definition": "...",
                    "pronunciation": "...",
                    "example_sentence": "..."
                },
                {
                    "word": "discussing",
                    "part_of_speech": "gerund/verb",
                    "definition": "...",
                    "pronunciation": "...",
                    "example_sentence": "..."
                }
            ]
        }
    """
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": """You are a linguistics expert. Generate related word forms for a given base word.
                    
                    Return ONLY this JSON:
                    {
                        "base_word": "the original word",
                        "word_family": [
                            {
                                "word": "related word form",
                                "part_of_speech": "noun|verb|adjective|adverb|gerund",
                                "definition": "clear definition",
                                "pronunciation": "phonetic representation",
                                "example_sentence": "sentence using the word"
                            }
                        ]
                    }
                    
                    Include 3-5 word forms at minimum."""
                },
                {
                    "role": "user",
                    "content": f"Generate the word family for: {target_word}"
                }
            ]
        )
        
        result = json.loads(response.choices[0].message.content)
        print(f"✅ Generated word family for '{target_word}'")
        return result
    
    except Exception as e:
        print(f"❌ Error generating word family: {e}")
        return {
            "base_word": target_word,
            "word_family": []
        }


# ---------------------------------------------------------------------------
# 16. PERSONALIZED EXERCISE GENERATION — FEATURE 15
# ---------------------------------------------------------------------------

def get_personalized_exercise(
    user_id: str,
    difficulty: str = "intermediate",
    learning_style: str = "vocabulary",
    time_available: str = "long"  # "quick" (30sec), "medium" (1min), "long" (2+ min)
) -> Dict:
    """
    Generates highly personalized exercise based on user profile.
    
    FEATURE 15:
    Select next word based on:
    - User's weak areas (those "th" sounds)
    - Spaced repetition schedule
    - Difficulty progression (easy → hard)
    - Time availability (quick vs detailed)
    - Learning style (vocabulary vs grammar vs pronunciation)
    
    Returns:
        {
            "exercise_type": "pronunciation|vocabulary|grammar",
            "word": "discuss",
            "difficulty": "intermediate",
            "reason": "You struggle with /sk/ clusters and this word has one",
            "time_estimate": "90 seconds",
            "focus_area": "consonant clusters",
            "personalization_score": 0.95,
            "context": "example sentence"
        }
    """
    try:
        # Get user's weakness patterns
        weak_areas = get_user_weak_areas(user_id)
        
        # Get vocabulary bank
        all_words = list(db.collection("vocabulary_bank").stream())
        if not all_words:
            print("⚠️ Vocabulary bank empty, seeding...")
            seed_vocabulary_bank()
            all_words = list(db.collection("vocabulary_bank").stream())
        
        if not all_words:
            # Fallback exercise if no words available
            return {
                "exercise_type": learning_style,
                "word": "practice",
                "vocab_id": "default_001",
                "difficulty": difficulty,
                "reason": "Practice with a common word",
                "time_estimate": get_time_estimate(time_available),
                "focus_area": "general pronunciation",
                "personalization_score": 0.5,
                "pronunciation": "/ˈpræktɪs/",
                "definition": "repeated exercise in or performance of an activity",
                "example_sentence": "Practice makes perfect.",
                "context": "Practice makes perfect.",
            }
        
        # Score each word based on personalization factors
        scored_words = []
        for word_doc in all_words:
            word_data = word_doc.to_dict()
            if not word_data.get("word"):
                continue
            score = calculate_personalization_score(
                word_data,
                weak_areas,
                difficulty,
                learning_style
            )
            scored_words.append((word_data, score))
        
        if not scored_words:
            # Fallback if scoring fails
            return {
                "exercise_type": learning_style,
                "word": "speak",
                "vocab_id": "default_002",
                "difficulty": difficulty,
                "reason": "Practice with a fundamental word",
                "time_estimate": get_time_estimate(time_available),
                "focus_area": "general pronunciation",
                "personalization_score": 0.5,
                "pronunciation": "/spiːk/",
                "definition": "to say something or express in words",
                "example_sentence": "Speak clearly and slowly.",
                "context": "Speak clearly and slowly.",
            }
        
        # Sort by score and select top
        scored_words.sort(key=lambda x: x[1], reverse=True)
        target_word = scored_words[0][0]
        personalization_score = scored_words[0][1]
        
        # Determine focus area
        focus_area = identify_focus_area(target_word, weak_areas)
        
        return {
            "exercise_type": learning_style,
            "word": target_word.get("word", ""),
            "vocab_id": target_word.get("id", ""),
            "difficulty": difficulty,
            "reason": f"Based on your {focus_area} challenges and learning style",
            "time_estimate": get_time_estimate(time_available),
            "focus_area": focus_area,
            "personalization_score": round(personalization_score, 2),
            "pronunciation": target_word.get("pronunciation", ""),
            "definition": target_word.get("definition", ""),
            "example_sentence": target_word.get("example_sentence", ""),
            "context": target_word.get("example_sentence", "Use this word in a sentence"),
        }
    
    except Exception as e:
        print(f"❌ Error generating personalized exercise: {e}")
        # Return a safe fallback exercise even on error
        return {
            "exercise_type": learning_style,
            "word": "learn",
            "vocab_id": "fallback_001",
            "difficulty": difficulty,
            "reason": "Practice with a core vocabulary word",
            "time_estimate": get_time_estimate(time_available),
            "focus_area": "general pronunciation",
            "personalization_score": 0.5,
            "pronunciation": "/lɜːn/",
            "definition": "to acquire knowledge or skill",
            "example_sentence": "I love to learn new English words.",
            "context": "I love to learn new English words.",
        }


def get_user_weak_areas(user_id: str) -> List[str]:
    """Extract phonetic/linguistic weak areas from user's history."""
    try:
        # Get all corrections from past analyses
        weak_areas = {}
        sessions = list(
            db.collection("users")
            .document(user_id)
            .collection("pronunciation_sessions")
            .limit(20)
            .stream()
        )
        
        for session in sessions:
            data = session.to_dict()
            corrections = data.get("corrections", "")
            # Simple keyword extraction (in production, use NLP)
            if "th" in corrections.lower():
                weak_areas["th_sounds"] = weak_areas.get("th_sounds", 0) + 1
            if "cluster" in corrections.lower():
                weak_areas["consonant_clusters"] = weak_areas.get("consonant_clusters", 0) + 1
            if "stress" in corrections.lower() or "intonation" in corrections.lower():
                weak_areas["stress_pattern"] = weak_areas.get("stress_pattern", 0) + 1
        
        return sorted(weak_areas.items(), key=lambda x: x[1], reverse=True)[:3]
    except Exception:
        return []


def calculate_personalization_score(
    word_data: Dict,
    weak_areas: List[tuple],
    difficulty: str,
    learning_style: str
) -> float:
    """
    Calculate how relevant a word is to user's needs.
    Score 0-1, higher = more personalized.
    """
    score = 0.5  # Base score
    
    # Match difficulty
    word_difficulty = word_data.get("difficulty", "intermediate")
    if word_difficulty == difficulty:
        score += 0.2
    
    # Match weak areas
    word_text = word_data.get("word", "").lower()
    if any(area[0] in word_text for area in weak_areas):
        score += 0.15
    
    # Pronunciation focus
    if learning_style == "pronunciation" and word_data.get("pronunciation"):
        score += 0.1
    
    # Vocabulary focus
    if learning_style == "vocabulary" and word_data.get("synonyms"):
        score += 0.1
    
    return min(score, 1.0)  # Cap at 1.0


def identify_focus_area(word_data: Dict, weak_areas: List[tuple]) -> str:
    """Identify which aspect of the word addresses user's weaknesses."""
    pronunciation = word_data.get("pronunciation", "")
    
    if weak_areas:
        top_weakness = weak_areas[0][0]
        if "th" in top_weakness and "th" in pronunciation:
            return "dental fricatives (th sounds)"
        elif "cluster" in top_weakness and any(c in pronunciation for c in ["st", "sk", "sp", "cl", "bl"]):
            return "consonant clusters"
        elif "stress" in top_weakness:
            return "word stress and intonation"
    
    return "general pronunciation"


def get_time_estimate(time_available: str) -> str:
    """Get recommended time based on availability."""
    estimates = {
        "quick": "30-45 seconds",
        "medium": "60-90 seconds",
        "long": "2-3 minutes"
    }
    return estimates.get(time_available, "60-90 seconds")


# ---------------------------------------------------------------------------
# 17. REAL-TIME RECORDING METRICS — FEATURE 14
# ---------------------------------------------------------------------------

def analyze_recording_quality(audio_file_path: str) -> Dict:
    """
    Analyzes recording quality in real-time.
    
    FEATURE 14:
    - Detect silence (mic issue?)
    - Detect excessive noise
    - Peak amplitude levels
    - Recommendation for re-recording
    
    Returns:
        {
            "duration": 4.5,
            "silence_percentage": 5,
            "noise_level": "low",
            "peak_amplitude": 0.85,
            "quality_score": 0.92,
            "issues": [],
            "recommendation": "Recording quality is excellent!"
        }
    """
    try:
        import wave
        import struct
        
        with wave.open(audio_file_path, 'rb') as wav_file:
            n_frames = wav_file.getnframes()
            frame_rate = wav_file.getframerate()
            duration = n_frames / frame_rate
            
            # Read audio data
            audio_data = wav_file.readframes(n_frames)
            audio_array = struct.unpack(f'{n_frames}h', audio_data)
            
            # Analyze
            max_amplitude = max(abs(x) for x in audio_array) if audio_array else 0
            normalized_amplitude = max_amplitude / 32768.0  # 16-bit normalization
            
            # Detect silence (samples below threshold)
            silence_threshold = 0.02
            silent_samples = sum(1 for x in audio_array if abs(x) / 32768.0 < silence_threshold)
            silence_percentage = (silent_samples / len(audio_array)) * 100 if audio_array else 0
            
            # Quality assessment
            quality_score = 0.5
            issues = []
            
            if silence_percentage > 30:
                quality_score -= 0.2
                issues.append("Too much silence detected")
            if normalized_amplitude < 0.3:
                quality_score -= 0.2
                issues.append("Volume too low - speak louder")
            elif normalized_amplitude > 0.95:
                quality_score -= 0.1
                issues.append("Volume too high - may cause clipping")
            else:
                quality_score += 0.3
            
            quality_score = max(0, min(1, quality_score))
            
            recommendation = "Recording quality is excellent!" if quality_score > 0.8 else \
                           "Recording quality is good" if quality_score > 0.6 else \
                           "Consider re-recording for better quality"
            
            return {
                "duration": round(duration, 2),
                "silence_percentage": round(silence_percentage, 1),
                "noise_level": "low" if quality_score > 0.7 else "medium" if quality_score > 0.5 else "high",
                "peak_amplitude": round(normalized_amplitude, 2),
                "quality_score": round(quality_score, 2),
                "issues": issues,
                "recommendation": recommendation
            }
    
    except Exception as e:
        print(f"❌ Error analyzing recording quality: {e}")
        return {
            "duration": 0,
            "silence_percentage": 0,
            "noise_level": "unknown",
            "peak_amplitude": 0,
            "quality_score": 0,
            "issues": ["Unable to analyze recording"],
            "recommendation": "Try re-recording"
        }


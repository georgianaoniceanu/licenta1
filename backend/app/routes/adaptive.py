from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from app.services.auth import verify_token
from app.services.firestore import save_learner_profile, get_learner_profile
import random

router = APIRouter()

# Define phoneme exercise data (matches frontend)
PHONEME_EXERCISES = [
    {
        "phoneme": "/u:/-/ʊ/",
        "description": "Tense vs Lax U",
        "words": ["goose", "book", "food", "look", "pool"],
        "tip": "Keep /u:/ tense (longer), /ʊ/ lax (shorter).",
        "error_rate": 0.55,  # 55% error rate from research
    },
    {
        "phoneme": "/i:/-/ɪ/",
        "description": "Tense vs Lax I",
        "words": ["fleece", "kit", "see", "sit", "cheese"],
        "tip": "Minimal pairs: fleece/kit. Keep /i:/ forward and tense.",
        "error_rate": 0.45,
    },
    {
        "phoneme": "/ð/",
        "description": "TH voiced",
        "words": ["the", "this", "that", "there", "though"],
        "tip": "NOT in Romanian - tongue BETWEEN teeth + add voice.",
        "error_rate": 1.0,  # 100% error rate - critical
    },
    {
        "phoneme": "/θ/",
        "description": "TH unvoiced",
        "words": ["think", "three", "through", "thanks", "thunder"],
        "tip": "Place tongue between teeth and blow air.",
        "error_rate": 1.0,  # 100% error rate - critical
    },
    {
        "phoneme": "/æ/-/ɑ:/",
        "description": "Short A vs Back A",
        "words": ["cat", "bad", "math", "father", "park"],
        "tip": "Open wider for /æ/, further back for /ɑ:/.",
        "error_rate": 0.65,
    },
    {
        "phoneme": "/ʌ/",
        "description": "Schwa sound",
        "words": ["cup", "blood", "mud", "sun", "love"],
        "tip": "More central and less open than Romanian /a/.",
        "error_rate": 0.50,
    },
    {
        "phoneme": "[ɫ] Dark L",
        "description": "Dark L at end",
        "words": ["milk", "wall", "tell", "field", "small"],
        "tip": "Position rule: clear L at start, dark at end of word.",
        "error_rate": 0.40,
    },
    {
        "phoneme": "/ŋ/",
        "description": "NG sound",
        "words": ["doing", "sing", "ring", "thing", "morning"],
        "tip": "Train final /ŋ/ WITHOUT adding extra [g].",
        "error_rate": 0.35,
    },
    {
        "phoneme": "[kʰ]",
        "description": "Aspirated K",
        "words": ["keep", "kind", "kit", "king", "key"],
        "tip": "Show spectrograms: correct VOT (40-80ms).",
        "error_rate": 0.60,
    },
    {
        "phoneme": "/ə/",
        "description": "Schwa (unstressed)",
        "words": ["about", "sofa", "comma", "around", "alone"],
        "tip": "Light but not completely elided sound.",
        "error_rate": 0.48,
    },
    {
        "phoneme": "[pʰ]",
        "description": "Aspirated P",
        "words": ["pen", "put", "pat", "pick", "peace"],
        "tip": "VOT training: English = 50-100ms.",
        "error_rate": 0.58,
    },
    {
        "phoneme": "[tʰ]",
        "description": "Aspirated T",
        "words": ["tea", "top", "time", "take", "talk"],
        "tip": "Explicit aspiration for start of word.",
        "error_rate": 0.62,
    },
]


class PhonemeStatInput(BaseModel):
    phoneme: str
    attempts: int
    correct_attempts: int
    accuracy: float
    last_practiced: Optional[str] = None


class LearnerProfileInput(BaseModel):
    average_accuracy: float
    total_sessions: int
    words_practiced: int
    learning_pace: str  # 'slow', 'normal', 'fast'
    accuracy_trend: float
    weak_phonemes: List[PhonemeStatInput]
    strong_phonemes: List[PhonemeStatInput]
    language_level: str


class NextExerciseResponse(BaseModel):
    phoneme: str
    description: str
    words: List[str]
    tip: str
    difficulty: str  # 'beginner', 'intermediate', 'advanced'
    reason: str


@router.post("/next-exercise")
async def get_next_exercise(
    profile: LearnerProfileInput,
    authorization: str = Header(None)
) -> NextExerciseResponse:
    """
    Get the next recommended exercise based on learner profile.
    
    Strategy:
    1. If weak phonemes exist and average_accuracy < 75%, suggest weak phoneme
    2. If average_accuracy >= 75%, suggest challenging/rare sounds
    3. If learning_pace is 'fast', suggest harder variations
    4. If learning_pace is 'slow', focus on weaker areas with repetition
    """
    
    try:
        # Verify user token if provided
        user_id = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
            user_id = verify_token(token)
        
        # Determine next exercise based on profile
        next_exercise = _recommend_exercise(profile)
        
        # Save profile to Firestore if user is authenticated
        if user_id:
            save_learner_profile(user_id, profile.dict())
        
        return next_exercise
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _recommend_exercise(profile: LearnerProfileInput) -> NextExerciseResponse:
    """
    Internal logic for recommending next exercise.
    """
    
    # Priority 1: Focus on weak phonemes if accuracy is low
    if profile.weak_phonemes and profile.average_accuracy < 75:
        weak_phoneme = profile.weak_phonemes[0]
        
        # Find matching exercise
        exercise = next(
            (ex for ex in PHONEME_EXERCISES if ex["phoneme"] == weak_phoneme.phoneme),
            None
        )
        
        if exercise:
            return NextExerciseResponse(
                phoneme=exercise["phoneme"],
                description=exercise["description"],
                words=exercise["words"],
                tip=exercise["tip"],
                difficulty="beginner" if weak_phoneme.accuracy < 40 else "intermediate",
                reason=f"Focus on weak area: {weak_phoneme.phoneme} ({weak_phoneme.accuracy:.0f}% accuracy)"
            )
    
    # Priority 2: If learning fast and accuracy is good, suggest challenging sounds
    if profile.learning_pace == "fast" and profile.average_accuracy >= 75:
        # Pick phonemes with highest error rates in research
        challenging = [ex for ex in PHONEME_EXERCISES if ex["error_rate"] > 0.7]
        if challenging:
            exercise = random.choice(challenging)
            return NextExerciseResponse(
                phoneme=exercise["phoneme"],
                description=exercise["description"],
                words=exercise["words"],
                tip=exercise["tip"],
                difficulty="advanced",
                reason=f"Challenge yourself with {exercise['phoneme']}"
            )
    
    # Priority 3: Continue with medium-difficulty sounds for practice
    exercise = random.choice(PHONEME_EXERCISES)
    return NextExerciseResponse(
        phoneme=exercise["phoneme"],
        description=exercise["description"],
        words=exercise["words"],
        tip=exercise["tip"],
        difficulty="intermediate",
        reason=f"Practice {exercise['phoneme']}"
    )


@router.get("/difficulty/{accuracy_score}")
async def get_difficulty_level(accuracy_score: float) -> dict:
    """
    Get adaptive difficulty level based on accuracy score.
    """
    if accuracy_score > 85:
        return {
            "level": "advanced",
            "instruction": "You're doing great! Try more challenging phoneme pairs.",
        }
    elif accuracy_score >= 60:
        return {
            "level": "intermediate",
            "instruction": "Good progress! Keep practicing the same phonemes.",
        }
    else:
        return {
            "level": "beginner",
            "instruction": "Take your time. Practice makes perfect!",
        }

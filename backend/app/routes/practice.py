"""
Practice Hub — closes the diagnostic ⇄ intervention loop

Four endpoints, each grounded in a piece of literature already cited in
articles_text/:

  POST /practice/adaptive        — LLM-driven exercises targeting the user's
                                    weakest measured indicator (data-informed,
                                    not random). Closes the assessment loop
                                    advocated by Alderson (2005) and demanded
                                    by the project supervisor.
                                    Norris, J. M. (2017). Task-based language
                                    assessment: Aligning designs with intended uses
                                    and consequences. JLTA Journal, 21, 3–20.
                                    Task-based designs are required when the goal is
                                    to assess what learners can *do*, not merely
                                    what they know; adaptive tasks here instantiate
                                    this principle per indicator gap.
                                    DeKeyser, R. M., & Suzuki, Y. (2025). Skill
                                    acquisition theory. Routledge (pp. 157–182).
                                    Targeting the weakest skill for focused practice
                                    accelerates proceduralization (Anderson 2004);
                                    LLM-generated exercises provide the varied input
                                    needed for automatization.

  GET  /practice/word-retention  — Tracks which B2/C1/C2 words the learner has
                                    actually re-used across multiple sessions.
                                    Cepeda et al. (2006): spaced re-use is the
                                    strongest predictor of lexical retention.

  POST /practice/reading         — Generates a CEFR-targeted reading passage
                                    + 5 multiple-choice comprehension items.
                                    Adds the third skill (after speaking and
                                    writing).

  POST /practice/listening       — TTS reads a sentence; the user transcribes;
                                    backend scores the gap. Adds the fourth
                                    skill (listening comprehension).
                                    Asrifan, A., Cardoso, L. M. O. B., & Vargheese,
                                    K. J. (2026). Automated feedback for speaking
                                    and writing skills: Deep learning in English
                                    language assessment. EduLite, 11(1), 67–85.
                                    AI-generated feedback produces statistically
                                    significant gains in grammatical accuracy,
                                    lexical diversity, and fluency; most effective
                                    for form-focused elements.

All four are wrapped with @cached so repeated identical inputs do not burn
Groq quota during a thesis demonstration.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

from app.services.auth import verify_token
from app.services.cache import cached

# Optional TTS (ElevenLabs)
try:
    from app.services.tts import text_to_speech
    _TTS_OK = True
except Exception:
    text_to_speech = None  # type: ignore
    _TTS_OK = False

load_dotenv()
_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _require_user(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        return verify_token(token)["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


def _strip_code_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _parse_json(content: str) -> Any:
    """LLMs sometimes wrap JSON in markdown — strip and parse."""
    raw = _strip_code_fences(content)
    return json.loads(raw)


# ─────────────────────────────────────────────────────────────────────────────
# 1. ADAPTIVE EXERCISES
# ─────────────────────────────────────────────────────────────────────────────

class AdaptivePayload(BaseModel):
    cefr_level: str = "B1"                              # current learner CEFR
    weakest_category: str = "collocations"               # from romanian_errors.categories
    weakest_criterion: str = "lexical_resource"          # from IELTS profile
    weakest_phoneme: Optional[str] = None                # e.g. "/θ/", "/ð/"
    target_exam: str = "general"


@cached("adaptive_exercises", ttl=3600)
def _generate_adaptive(cefr: str, category: str, criterion: str,
                       phoneme: Optional[str], exam: str) -> Dict[str, Any]:
    phoneme_block = (
        f"- The learner also struggles with the phoneme {phoneme}. Include 1 "
        f"speaking exercise where this sound appears in 3+ words.\n"
        if phoneme else ""
    )
    prompt = f"""You are a CEFR-aligned English coach for Romanian L1 speakers.
Generate 5 highly targeted practice exercises informed by this diagnosis:

- CEFR level: {cefr}
- Worst grammar category: {category} (Pungă & Pârlog 2015; Popescu 2013)
- Worst IELTS criterion: {criterion}
- Target exam: {exam}
{phoneme_block}

Each exercise must target the SPECIFIC weakness above. Reply with JSON, no markdown:
{{
  "exercises": [
    {{
      "type": "fill_blank" | "rewrite" | "speak_aloud" | "collocation" | "translate",
      "instruction": "<short instruction>",
      "prompt": "<the actual text/sentence/word>",
      "expected": "<expected answer or model answer>",
      "explanation": "<why this targets {category}/{criterion}>"
    }}
  ]
}}

Rules:
1. Difficulty must match {cefr} (use EVP-appropriate vocabulary).
2. Each exercise must be DIFFERENT in type and content.
3. Explanations must reference the specific weakness, not generic advice.
4. Return EXACTLY 5 exercises.
"""
    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a strict JSON generator. Return only valid JSON, no markdown."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    try:
        return _parse_json(resp.choices[0].message.content)
    except Exception:
        return {"exercises": []}


@router.post("/practice/adaptive")
async def adaptive_exercises(payload: AdaptivePayload, authorization: str = Header(None)):
    _require_user(authorization)
    data = _generate_adaptive(
        payload.cefr_level, payload.weakest_category,
        payload.weakest_criterion, payload.weakest_phoneme, payload.target_exam,
    )
    return {
        "success": True,
        "data": data,
        "diagnosis_used": {
            "cefr": payload.cefr_level,
            "grammar_category": payload.weakest_category,
            "ielts_criterion": payload.weakest_criterion,
            "phoneme": payload.weakest_phoneme,
            "target_exam": payload.target_exam,
        },
        "research": (
            "Adaptive exercise generation closes the diagnostic→intervention loop "
            "(Alderson 2005). Difficulty calibrated via EVP/Cambridge thresholds; "
            "exercise targeting informed by Pungă & Pârlog (2015) error categories "
            "and IELTS criterion weakness."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. WORD RETENTION  (Cepeda et al. 2006 spaced re-use)
# ─────────────────────────────────────────────────────────────────────────────

class RetentionPayload(BaseModel):
    # List of session bundles — each is the set of advanced words produced
    sessions: List[Dict[str, Any]]    # [{ts, words: [...]}]


@router.post("/practice/word-retention")
async def word_retention(payload: RetentionPayload, authorization: str = Header(None)):
    """
    Cepeda et al. (2006): retention is predicted by spaced re-use across
    multiple sessions. A word seen in ≥3 distinct sessions is considered
    "retained"; in 2 sessions = "consolidating"; in 1 = "introduced".

    Returns the user's vocabulary growth profile based on their own session
    history (client passes the already-stored data to keep the backend
    stateless w.r.t. AsyncStorage).
    """
    _require_user(authorization)

    word_to_sessions: Dict[str, List[int]] = {}
    for s in payload.sessions:
        ts = int(s.get("ts", 0))
        words = s.get("words") or []
        for w in words:
            wl = str(w).lower().strip()
            if not wl or len(wl) < 3:
                continue
            word_to_sessions.setdefault(wl, []).append(ts)

    retained: List[Dict[str, Any]] = []
    consolidating: List[Dict[str, Any]] = []
    introduced: List[Dict[str, Any]] = []

    for word, ts_list in word_to_sessions.items():
        unique_ts = sorted(set(ts_list))
        entry = {
            "word": word,
            "occurrences": len(ts_list),
            "session_count": len(unique_ts),
            "first_seen": unique_ts[0] if unique_ts else None,
            "last_seen": unique_ts[-1] if unique_ts else None,
        }
        if len(unique_ts) >= 3:
            retained.append(entry)
        elif len(unique_ts) == 2:
            consolidating.append(entry)
        else:
            introduced.append(entry)

    retained.sort(key=lambda e: -e["session_count"])
    consolidating.sort(key=lambda e: -e["occurrences"])
    introduced.sort(key=lambda e: -e["occurrences"])

    total = len(word_to_sessions)
    return {
        "success": True,
        "data": {
            "total_advanced_words": total,
            "retained_count": len(retained),
            "consolidating_count": len(consolidating),
            "introduced_count": len(introduced),
            "retention_rate": round(len(retained) / total * 100, 1) if total else 0.0,
            "retained": retained[:30],
            "consolidating": consolidating[:30],
            "introduced": introduced[:30],
        },
        "research": (
            "Cepeda et al. (2006): retention predicted by spaced re-use. "
            "Operationalisation: ≥3 sessions = retained, 2 = consolidating, 1 = introduced. "
            "Source file: articles_text/Cepeda2006.txt"
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. READING COMPREHENSION
# ─────────────────────────────────────────────────────────────────────────────

class ReadingPayload(BaseModel):
    cefr_level: str = "B1"
    topic: Optional[str] = None       # if omitted, LLM picks one
    domain: Optional[str] = None      # COCAGenre value: academic, newspaper, fiction, spoken, magazine…


@cached("reading_passage", ttl=24 * 3600)
def _generate_reading(cefr: str, topic: Optional[str], domain: Optional[str]) -> Dict[str, Any]:
    topic_clause = f"on the topic of {topic}" if topic else "on an interesting general-knowledge topic"
    domain_clause = f"Stylistic register: {domain} (COCA top-level genre)." if domain else ""

    prompt = f"""Generate one short reading-comprehension exercise for a CEFR {cefr} learner.

Write a {('150-180' if cefr in ('B1', 'B2') else '200-260')}-word passage {topic_clause}.
{domain_clause}
Then write 5 multiple-choice comprehension questions; each has 4 options (A-D) and 1 correct answer.
Questions must mix levels: 2 literal, 2 inferential, 1 vocabulary-in-context.

Return JSON only, no markdown:
{{
  "title": "<short title>",
  "passage": "<the passage>",
  "word_count": <int>,
  "questions": [
    {{
      "type": "literal" | "inferential" | "vocabulary",
      "question": "<question text>",
      "options": {{ "A": "...", "B": "...", "C": "...", "D": "..." }},
      "correct": "A" | "B" | "C" | "D",
      "explanation": "<why this answer is correct>"
    }}
  ]
}}
"""
    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a strict JSON generator. Return only valid JSON, no markdown."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
    )
    try:
        return _parse_json(resp.choices[0].message.content)
    except Exception:
        return {"title": "", "passage": "", "questions": []}


@router.post("/practice/reading")
async def reading_comprehension(payload: ReadingPayload, authorization: str = Header(None)):
    _require_user(authorization)
    data = _generate_reading(payload.cefr_level, payload.topic, payload.domain)
    return {
        "success": True,
        "data": data,
        "research": (
            "Reading comprehension assessment at CEFR-calibrated difficulty. Mixed item "
            "types (literal, inferential, vocabulary-in-context) following the Cambridge "
            "ESOL reading-test framework."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. LISTENING PRACTICE
# ─────────────────────────────────────────────────────────────────────────────

class ListeningGenerateBody(BaseModel):
    cefr_level: str = "B1"
    topic: Optional[str] = None


@cached("listening_text", ttl=24 * 3600)
def _generate_listening_text(cefr: str, topic: Optional[str]) -> str:
    topic_clause = f"about {topic}" if topic else "on any everyday topic"
    prompt = f"""Generate ONE single English sentence {topic_clause} appropriate for a CEFR {cefr} listener.
Constraints:
- 12-22 words
- natural conversational rhythm (not a question)
- include at least one B2+ vocabulary item if CEFR is B2 or higher
Respond with ONLY the sentence — no quotes, no JSON, no markdown."""
    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
    )
    text = resp.choices[0].message.content.strip().strip('"').strip()
    return text or "The library is one of the most peaceful places I know to read for a few hours."


@router.post("/practice/listening/generate")
async def listening_generate(payload: ListeningGenerateBody, authorization: str = Header(None)):
    """Generate a target sentence + return its audio (ElevenLabs TTS)."""
    _require_user(authorization)
    sentence = _generate_listening_text(payload.cefr_level, payload.topic)

    audio_b64 = ""
    if _TTS_OK and text_to_speech:
        try:
            audio_bytes = text_to_speech(sentence)
            import base64
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e:
            print(f"[practice/listening] TTS failed: {e}")

    return {
        "success": True,
        "data": {
            "sentence": sentence,
            "word_count": len(sentence.split()),
            "audio_base64": audio_b64,
            "audio_available": bool(audio_b64),
        },
    }


class ListeningScoreBody(BaseModel):
    target: str
    transcription: str


def _normalize_for_compare(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s']", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


@router.post("/practice/listening/score")
async def listening_score(payload: ListeningScoreBody, authorization: str = Header(None)):
    """
    Score the learner's transcription against the target sentence.
    Returns word-level diff + character-level similarity.
    """
    _require_user(authorization)
    target = _normalize_for_compare(payload.target)
    typed  = _normalize_for_compare(payload.transcription)

    if not target or not typed:
        return {"success": True, "data": {"score": 0, "matched": [], "missed": [], "extra": []}}

    target_words = target.split()
    typed_words  = typed.split()

    # Word-level diff via SequenceMatcher
    matcher = SequenceMatcher(None, target_words, typed_words)
    matched: List[str] = []
    missed: List[str] = []
    extra: List[str] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            matched.extend(target_words[i1:i2])
        elif tag == "delete":
            missed.extend(target_words[i1:i2])
        elif tag == "insert":
            extra.extend(typed_words[j1:j2])
        elif tag == "replace":
            missed.extend(target_words[i1:i2])
            extra.extend(typed_words[j1:j2])

    char_sim = round(SequenceMatcher(None, target, typed).ratio() * 100, 1)
    word_score = round(len(matched) / max(len(target_words), 1) * 100, 1)

    return {
        "success": True,
        "data": {
            "score": word_score,
            "char_similarity": char_sim,
            "matched": matched,
            "missed": missed,
            "extra": extra,
            "target_word_count": len(target_words),
            "matched_count": len(matched),
        },
    }

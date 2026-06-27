from groq import Groq
from dotenv import load_dotenv
import os
import json
import re
import difflib

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Import complete Romanian phonological difficulty data (Măchiță 2021)
from app.services.Romanian_Phone_Patterns import (
    VOWEL_DIFFICULTIES,
    CONSONANT_DIFFICULTIES,
    ALLOPHONE_DIFFICULTIES,
    ROMANIAN_SPEAKER_PHONEME_RANKING,
    INTERVENTION_STRATEGIES,
    PHONEME_EXERCISE_LEVELS,
)

# Flat map: IPA symbol → difficulty data (used in build_phoneme_result)
# Covers both vowels and consonants from Măchiță (2021)
_ROMANIAN_HARD_PHONEMES: dict = {}
for _name, _data in VOWEL_DIFFICULTIES.items():
    # Extract IPA symbols from names like "/i:/ vs /ɪ/"
    for _sym in re.findall(r"[iːɪuʊæɑʌəɐ]+", _name):
        _ROMANIAN_HARD_PHONEMES[_sym] = {**_data, "category": "vowel", "name": _name}
for _name, _data in CONSONANT_DIFFICULTIES.items():
    for _sym in re.findall(r"[θðŋ]", _name):
        _ROMANIAN_HARD_PHONEMES[_sym] = {**_data, "category": "consonant", "name": _name}
for _name, _data in ALLOPHONE_DIFFICULTIES.items():
    for _sym in re.findall(r"[ɫ]", _name):
        _ROMANIAN_HARD_PHONEMES[_sym] = {**_data, "category": "allophone", "name": _name}

# ============================================================================
# ROMANIAN LEARNER PHONEME ERROR PATTERNS (from Măchiță 2021 dissertation)
# ============================================================================

ROMANIAN_PRONUNCIATION_PATTERNS = {
    # Interdental fricatives - CRITICAL for Romanian learners
    "/θ/ (voiceless interdental)": {
        "error_rate": 90,  # 90% of Romanian learners make errors
        "correct_rate": 10,  # Only 10% produce correctly all tasks
        "substitutions": {
            "/t/ (stopping)": {
                "frequency": 60,
                "example": "think → tink",
                "severity": "high",
                "context": "Most common in all positions"
            },
            "/f/ (fronting)": {
                "frequency": 25,
                "example": "think → fink",
                "severity": "high",
                "context": "Less common, but occurs"
            },
            "/s/ (sibilant)": {
                "frequency": 15,
                "example": "think → sink",
                "severity": "medium",
                "context": "Rare for Romanian (more for French)"
            }
        },
        "formant_analysis": {
            "target_f1": 273,  # Hz - close vowel space
            "target_f2": 2289,  # Hz - front vowel
            "description": "Voiceless interdental, energy 2000-3000 Hz"
        },
        "feedback": "The /θ/ sound requires your tongue between teeth. Try: 'think', 'three', 'tooth'"
    },

    "/ð/ (voiced interdental)": {
        "error_rate": 90,  # 90% error rate
        "correct_rate": 10,  # 10% produce correctly
        "substitutions": {
            "/d/ (stopping)": {
                "frequency": 70,
                "example": "father → vader",
                "severity": "high",
                "context": "Most common substitution"
            },
            "/z/ (sibilant)": {
                "frequency": 20,
                "example": "father → fazzer",
                "severity": "high",
                "context": "Less common"
            }
        },
        "formant_analysis": {
            "target_f1": 386,
            "target_f2": 2038,
            "duration_ms": 74,
            "description": "Voiced interdental fricative, energy ~2000 Hz"
        },
        "feedback": "The /ð/ sound is voiced /θ/. Say: 'this', 'that', 'father' with vibration in your throat"
    },

    "/ŋ/ (velar nasal)": {
        "error_rate": 50,  # 50% error rate
        "correct_rate": 50,  # Half produce correctly
        "substitutions": {
            "/ng/ (overgeneralization)": {
                "frequency": 50,
                "example": "doing → doing-g",
                "severity": "medium",
                "context": "Adding /g/ after nasal (50% of learners)"
            }
        },
        "formant_analysis": {
            "target_f1": 428,
            "target_f2": None,  # Nasal, different formants
            "description": "Velar nasal, low F1 around 428 Hz"
        },
        "feedback": "The /ŋ/ ends the nose. Say: 'doing', 'ring', 'sing' without adding /g/"
    },

    "[ɫ] (dark L)": {
        "error_rate": 50,  # 50% never produce dark L
        "correct_rate": 50,
        "substitutions": {
            "[l] (clear L everywhere)": {
                "frequency": 50,
                "example": "milk → mil",
                "severity": "low",
                "context": "Use clear [l] instead of dark [ɫ] at end"
            }
        },
        "formant_analysis": {
            "target_f2": 1100,  # Below 1100 Hz = dark L
            "description": "Dark L at word end: backed, velarized"
        },
        "feedback": "Dark L at word end: 'milk', 'girl'. Light L at start: 'love', 'light'"
    },

    "[kh] (aspirated K)": {
        "error_rate": 50,  # 50% over-aspirate
        "correct_rate": 50,
        "substitutions": {
            "[k] (under-aspirated)": {
                "frequency": 30,
                "example": "cars → kars (less aspiration)",
                "severity": "low",
                "context": "Aspiration inconsistency"
            }
        },
        "vot_analysis": {
            "target_vot_ms": "30-40",  # Voice Onset Time (ms)
            "romanian_learner_vot": 75,  # Over-aspirated
            "description": "Aspiration duration too long"
        },
        "feedback": "Don't over-aspirate /k/. Quick release: 'cars', 'king', 'keep'"
    },

    "[th] (aspirated T)": {
        "error_rate": 70,  # 70% under-aspirate
        "correct_rate": 30,
        "substitutions": {
            "[t] (under-aspirated)": {
                "frequency": 70,
                "example": "time → time (no aspiration)",
                "severity": "medium",
                "context": "Missing VOT (14 ms vs 30-40 ms target)"
            }
        },
        "vot_analysis": {
            "target_vot_ms": "30-40",  # Voice Onset Time (ms)
            "romanian_learner_vot": 14,  # Under-aspirated
            "description": "Not enough puff of air after /t/"
        },
        "feedback": "Aspirate /t/ at word start: 'time', 'two', 'tree' - add puff of air"
    }
}

# ============================================================================
# COARTICULATION & CONTEXT RULES (English phonology chapter)
# ============================================================================

COARTICULATION_RULES = {
    "alveolar_before_dental": {
        "rule": "Alveolar consonants become dental before dental consonants",
        "examples": [
            {"word": "eighth", "transcription": "[eɪtθ̪]", "description": "/t/ becomes dental [t̪]"},
            {"word": "tenth", "transcription": "[tenθ̪]", "description": "/n/ becomes dental [n̪]"},
            {"word": "wealth", "transcription": "[wɛlθ̪]", "description": "/l/ becomes dental [l̪]"}
        ],
        "cross_word": "at this → [æt̪ðɪs]",
        "feedback": "Context matters: /t/ changes before /θ/ or /ð/"
    },
    
    "voiceless_stop_aspiration": {
        "rule": "Voiceless stops /p,t,k/ are aspirated syllable-initially",
        "examples": [
            {"word": "pip", "transcription": "[phɪp]"},
            {"word": "test", "transcription": "[thɛst]"},
            {"word": "kick", "transcription": "[khɪk]"}
        ],
        "feedback": "Add puff of air after voiceless stops at word start"
    },

    "approximant_devoicing": {
        "rule": "After /p,t,k/, approximants /w,r,j,l/ are partly voiceless",
        "examples": [
            {"word": "play", "transcription": "[pl̥eɪ]"},
            {"word": "twin", "transcription": "[tw̥ɪn]"},
            {"word": "cue", "transcription": "[kju̥]"}
        ]
    }
}

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribe an audio file via Groq Whisper. The filename's extension and
    content-type matter to the API — pass (name, bytes, content-type) so the
    server knows the format regardless of the local tempfile name.

    NB: on Windows, `mimetypes.guess_type('.webm')` returns 'video/webm', which
    Whisper rejects. We maintain an explicit audio-only mapping.
    """
    import os
    ext = os.path.splitext(audio_file_path)[1].lower() or ".webm"
    audio_mime = {
        ".webm": "audio/webm",
        ".ogg":  "audio/ogg",
        ".oga":  "audio/ogg",
        ".m4a":  "audio/mp4",
        ".mp4":  "audio/mp4",
        ".mp3":  "audio/mpeg",
        ".wav":  "audio/wav",
        ".flac": "audio/flac",
    }.get(ext, "audio/webm")

    with open(audio_file_path, "rb") as f:
        data = f.read()
    print(f"[transcribe_audio] sending {len(data)} bytes as {ext} ({audio_mime}) to Whisper")
    try:
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=(f"recording{ext}", data, audio_mime),
            response_format="text",
            language="en",
        )
    except Exception as e:
        print(f"[transcribe_audio] Groq Whisper error: {e}")
        raise
    text = transcription if isinstance(transcription, str) else getattr(transcription, "text", "")
    print(f"[transcribe_audio] Whisper text: {repr(text)[:200]}")
    return text

_VOICED_TH_WORDS = {
    'the', 'this', 'that', 'these', 'those', 'they', 'them', 'their', 'there',
    'then', 'than', 'though', 'thus', 'with', 'bathe', 'breathe', 'father',
    'mother', 'brother', 'other', 'either', 'weather', 'feather', 'together',
    'whether', 'smooth', 'soothe', 'bother', 'lathe', 'teethe', 'tithe',
}
_VOICELESS_TH_WORDS = {
    'think', 'three', 'through', 'thank', 'thanks', 'thought', 'thousand',
    'thread', 'threat', 'throw', 'throat', 'thick', 'thin', 'thing', 'third',
    'thirst', 'thirty', 'tooth', 'teeth', 'truth', 'birth', 'earth', 'worth',
    'health', 'wealth', 'both', 'month', 'death', 'breath', 'bath', 'math',
    'path', 'cloth', 'north', 'south', 'thunder', 'Thursday', 'author',
}

def get_phoneme_patterns(target_text: str) -> dict:
    """Identify which Romanian-problematic phonemes appear in target text."""
    problematic: dict = {}
    words = set(re.sub(r"[^\w\s']", "", target_text.lower()).split())
    text_lower = target_text.lower()

    # /θ/ — voiceless TH (think, three, tooth …)
    if words & _VOICELESS_TH_WORDS:
        problematic['/θ/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/θ/ (voiceless interdental)']

    # /ð/ — voiced TH (the, this, father …)
    if words & _VOICED_TH_WORDS:
        problematic['/ð/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/ð/ (voiced interdental)']

    # /ŋ/ — velar nasal (ring, doing, sing …)
    if re.search(r'n[gk]|ing\b', text_lower):
        problematic['/ŋ/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/ŋ/ (velar nasal)']

    # [ɫ] dark L — present when l is word-final or before a consonant
    if re.search(r'l[bcdfghjklmnpqrstvwxyz]|l\b', text_lower):
        problematic['[ɫ]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[ɫ] (dark L)']

    # [kʰ] / [tʰ] — aspirated stops at stressed syllable onset
    for word in words:
        if word.startswith('k') or word.startswith('c') and len(word) > 1 and word[1] in 'aeiou':
            problematic['[kh]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[kh] (aspirated K)']
        if word.startswith('t') and (len(word) == 1 or word[1] not in ('h',)):
            problematic['[th]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[th] (aspirated T)']

    return problematic

def _norm_words(s: str):
    return re.sub(r"[^\w\s']", "", s.lower()).split()


def _similarity(transcribed: str, target: str) -> dict:
    """
    Deterministic ASR-based similarity between the Whisper transcription and the
    target. This is the ONLY objective signal we have: a robust ASR like Whisper
    normalises mild mispronunciations back to the intended word, so an exact
    match means the speech was *intelligible* — it does NOT prove phoneme-level
    accuracy. A mismatch, however, means the mispronunciation was strong enough
    that even the ASR misheard it → a reliable error signal.
    """
    tw, gw = _norm_words(transcribed), _norm_words(target)
    word_sim = difflib.SequenceMatcher(None, tw, gw).ratio() if gw else 0.0
    tc = re.sub(r"[^\w]", "", transcribed.lower())
    gc = re.sub(r"[^\w]", "", target.lower())
    char_sim = difflib.SequenceMatcher(None, tc, gc).ratio() if gc else 0.0
    return {
        "word_sim": word_sim,
        "char_sim": char_sim,
        "combined": 0.6 * word_sim + 0.4 * char_sim,
        "missed": [w for w in gw if w not in tw],
    }


def build_phoneme_result(colab: dict, target_text: str) -> dict:
    """
    Map the Colab wav2vec2-espeak result into the frontend feedback shape.
    This is REAL phoneme-level scoring (not intelligibility), so accuracy can
    legitimately reach Excellent and drops with genuine substitutions.
    """
    acc = int(colab.get("accuracy_score", 0))
    errors = colab.get("errors", []) or []
    expected = colab.get("expected_phonemes", []) or []
    produced = colab.get("produced_phonemes", []) or []

    # Build problematic phoneme list using complete Măchiță (2021) data.
    # Severity and error_rate now come from real research data where available.
    problematic = []
    for e in errors:
        exp  = (e.get("expected") or "").strip()
        prod = (e.get("produced") or "").strip()
        if not exp:          # pure insertion → skip
            continue

        # Look up in Romanian difficulty map (vowels + consonants + allophones)
        ro_data = None
        for sym in exp:
            if sym in _ROMANIAN_HARD_PHONEMES:
                ro_data = _ROMANIAN_HARD_PHONEMES[sym]
                break

        if ro_data:
            err_rate = ro_data.get("romanian_speaker_error_rate", 0)
            sev = "high" if err_rate >= 0.65 else "medium"
            category = ro_data.get("category", "consonant")
            name = ro_data.get("name", f"/{exp}/")
            example_str = (f"expected /{exp}/, you said [{prod}]" if prod
                           else f"expected /{exp}/ — omitted")
            # Add correction tip from intervention strategies if available
            intervention = INTERVENTION_STRATEGIES.get(name, {})
            tip = intervention.get("steps", [""])[0] if intervention else ""
        else:
            err_rate = 0
            sev = "medium"
            category = "consonant"
            name = f"/{exp}/"
            example_str = (f"expected /{exp}/, you said [{prod}]" if prod
                           else f"expected /{exp}/ — omitted")
            tip = ""

        problematic.append({
            "phoneme": f"/{exp}/",
            "phoneme_name": name,
            "category": category,
            "detected_error": prod or "(omitted)",
            "example": example_str,
            "severity": sev,
            "error_rate": round(err_rate * 100),   # e.g. 90 for /θ/
            "correction_tip": tip,
        })

    if acc >= 85:
        fb = "Excellent — your phonemes are well formed and close to native."
    elif acc >= 65:
        fb = "Good. Most sounds are correct; refine the highlighted phonemes."
    else:
        fb = "Several sounds were mispronounced — focus on the highlighted phonemes below."

    suggestions = [
        {"issue": f"/{e['expected']}/ → [{e.get('produced', '') or 'omitted'}]",
         "fix": f"Practise minimal pairs that contrast /{e['expected']}/",
         "priority": "high"}
        for e in errors[:3] if (e.get("expected") or "").strip()
    ]

    # Sort problematic by error_rate descending (highest Romanian difficulty first)
    problematic.sort(key=lambda x: x.get("error_rate", 0), reverse=True)

    # Determine which scoring engine was used (local CMU-dict PER or Colab wav2vec2)
    _engine      = colab.get("engine", "cmudict-PER (local, deterministic)")
    _engine_det  = colab.get("engine_detail", _engine)
    _tier        = colab.get("_tier", "local-cmudict-per")

    # Only the Colab wav2vec2 tier verifies pronunciation from the ACTUAL audio.
    # The local CMU-dict tier compares the target text to Whisper's transcription,
    # which normalises mispronunciations — so its score reflects intelligibility,
    # not phoneme accuracy. Flag that honestly so the frontend shows the caveat.
    _is_intelligibility = _tier != "colab-wav2vec2"

    return {
        "accuracy_score": acc,
        "intelligibility_only": _is_intelligibility,
        "problematic_phonemes": problematic[:6],
        "coarticulation_notes": "",
        "suggestions": suggestions,
        "overall_feedback": fb,
        "similarity": {"word": acc, "char": acc},
        "expected_phonemes": expected,
        "produced_phonemes": produced,
        "alignment": colab.get("alignment", []),
        "word_breakdown": colab.get("word_breakdown", []),
        "engine":      _engine,
        "engine_tier": _tier,   # "local-cmudict-per" | "colab-wav2vec2"
        "data_source": _engine_det,
        # Full Romanian phonological profile (Măchiță 2021) — for UI breakdown
        "romanian_phoneme_ranking": ROMANIAN_SPEAKER_PHONEME_RANKING,
        "exercise_priorities": PHONEME_EXERCISE_LEVELS,
    }


def analyze_pronunciation(transcribed_text: str, target_text: str) -> dict:
    """
    Calibrated pronunciation analysis (Măchiță 2021 Romanian patterns).

    Scoring is grounded on the deterministic ASR-similarity signal, NOT on the
    LLM's free guess (which previously returned ~95 whenever the two texts
    matched, because Whisper hides mispronunciations). The LLM is now used only
    for qualitative phoneme feedback, constrained to the computed score.
    """
    patterns = get_phoneme_patterns(target_text)
    sim = _similarity(transcribed_text, target_text)
    combined = sim["combined"]

    # ── Calibrated, honest score ────────────────────────────────────────────
    if not transcribed_text.strip():
        accuracy = 0
        verified_errors = True          # nothing usable captured
    elif combined >= 0.95:
        # ASR fully recovered the target → intelligible, but phonemes unverified.
        # Honest "good" band (NOT auto-Excellent). Slight deterministic variation.
        accuracy = 74 + (len(target_text) % 6)        # 74–79 → "Good"
        verified_errors = False
    else:
        # ASR misheard → genuine mispronunciation, scaled by how far off it was.
        accuracy = max(20, round(combined * 70))      # 20–66 → "Needs work"
        verified_errors = True

    # ── Problematic phonemes (deterministic, consistent with the score) ─────
    problematic = []
    for ph, details in patterns.items():
        subs = details.get("substitutions", {})
        first_sub = next(iter(subs.items()), (None, {}))
        problematic.append({
            "phoneme": ph,
            "detected_error": first_sub[0] or "—",
            "example": (first_sub[1] or {}).get("example", ""),
            # If the ASR misheard, treat these L1-hard sounds as likely errors;
            # otherwise present them as advisories to keep monitoring.
            "severity": "high" if verified_errors else "low",
            "error_rate": details.get("error_rate", 0),
            "frequency": (first_sub[1] or {}).get("frequency", 0),
        })

    # ── Qualitative feedback from the LLM, constrained to the computed score ──
    pattern_context = ""
    for ph, details in patterns.items():
        pattern_context += f"\n{ph}: error rate {details.get('error_rate', 0)}%"

    note = (
        "The speech was intelligible (ASR recovered the target), but exact "
        "phoneme accuracy cannot be verified from ASR alone — keep monitoring "
        "the Romanian-hard sounds below."
        if not verified_errors else
        "The recording differed from the target, indicating real "
        "mispronunciation of one or more sounds."
    )

    suggestions = []
    overall_feedback = note
    try:
        system_prompt = f"""You are a Romanian-English phonetics coach (Măchiță 2021 data).
The pronunciation has ALREADY been scored: accuracy_score = {accuracy}/100
({"intelligible, phonemes unverified" if not verified_errors else "mispronunciation detected"}).
Romanian-hard phonemes in this text:{pattern_context or " (general)"}

Write SHORT, encouraging feedback CONSISTENT with that score. Do NOT change the score.
Respond ONLY with valid JSON (no markdown):
{{
  "suggestions": [{{"issue": "short", "fix": "specific practice", "priority": "high|medium|low"}}],
  "overall_feedback": "1-2 sentences, encouraging, consistent with the score"
}}"""
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Target: '{target_text}'\nHeard: '{transcribed_text}'"},
            ],
        )
        llm = json.loads(response.choices[0].message.content)
        suggestions = llm.get("suggestions", []) or []
        overall_feedback = llm.get("overall_feedback") or note
    except Exception as e:
        print(f"[analyze_pronunciation] LLM feedback failed: {e}")

    return {
        "accuracy_score": accuracy,
        "intelligibility_only": not verified_errors,
        "problematic_phonemes": problematic,
        "coarticulation_notes": "",
        "suggestions": suggestions,
        "overall_feedback": overall_feedback,
        "similarity": {
            "word": round(sim["word_sim"] * 100),
            "char": round(sim["char_sim"] * 100),
        },
        "missed_words": sim["missed"],
        "romanian_patterns": patterns,
        "data_source": "Măchiță (2021) dissertation on Romanian L2 English phonology",
    }
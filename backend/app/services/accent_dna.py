from groq import Groq
from dotenv import load_dotenv
import os
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
            "target_vot_ms": 30-40,  # Voice Onset Time
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
            "target_vot_ms": 30-40,
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

def get_phoneme_patterns(target_text: str) -> dict:
    """Identify which Romanian-problematic phonemes appear in target text"""
    problematic = {}
    
    # Check for interdental fricatives
    if any(x in target_text.lower() for x in ['th', 'this', 'that', 'think', 'three', 'tooth', 'father']):
        if target_text.lower().startswith('th') or 'th' in target_text.lower()[:3]:
            problematic['/θ/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/θ/ (voiceless interdental)']
        else:
            problematic['/ð/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/ð/ (voiced interdental)']
    
    # Check for velar nasal
    if any(x in target_text.lower() for x in ['ng', 'ding', 'king', 'ring', 'doing']):
        problematic['/ŋ/'] = ROMANIAN_PRONUNCIATION_PATTERNS['/ŋ/ (velar nasal)']
    
    # Check for L variants
    if target_text.lower().endswith(('l', 'lk', 'ld', 'lf', 'lt')):
        problematic['[ɫ]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[ɫ] (dark L)']
    
    # Check for aspiration
    if target_text.lower().startswith(('k', 't')):
        if target_text.lower().startswith('k'):
            problematic['[kh]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[kh] (aspirated K)']
        else:
            problematic['[th]'] = ROMANIAN_PRONUNCIATION_PATTERNS['[th] (aspirated T)']
    
    return problematic

def analyze_pronunciation(transcribed_text: str, target_text: str) -> dict:
    """Analyze pronunciation with Romanian-specific patterns from Măchiță"""
    
    # Get relevant phoneme patterns
    patterns = get_phoneme_patterns(target_text)
    
    # Build context for LLM
    pattern_context = ""
    for phoneme, details in patterns.items():
        pattern_context += f"\n{phoneme}:\n"
        pattern_context += f"  Error rate: {details.get('error_rate', 0)}%\n"
        if 'substitutions' in details:
            for sub, info in details['substitutions'].items():
                pattern_context += f"  Common mistake: {sub} ({info.get('frequency', 0)}%) - {info.get('example', '')}\n"
    
    system_prompt = f"""You are a phonetics expert specializing in Romanian-English pronunciation.
You have Măchiță's (2021) dissertation data on Romanian learners' phoneme errors.

ROMANIAN LEARNER PATTERNS (from experimental data):
{pattern_context if pattern_context else "Check for /θ/, /ð/, /ŋ/, [ɫ], [kh], [th] errors"}

Your job:
1. Compare transcribed vs target text
2. Identify pronunciation errors using Romanian error patterns
3. For each error, provide specific correction feedback
4. Rate severity based on frequency data (high=common, medium=moderate, low=rare)
5. Provide encouraging feedback

Respond ONLY with valid JSON (no markdown):
{{
    "accuracy_score": 0-100,
    "problematic_phonemes": [
        {{"phoneme": "/θ/", "detected_error": "t", "example": "think→tink", "severity": "high", "error_rate": 90, "frequency": 60}}
    ],
    "coarticulation_notes": "Description of context-based errors if any",
    "suggestions": [
        {{"issue": "description", "fix": "specific practice", "priority": "high"}}
    ],
    "overall_feedback": "Encouraging feedback with next steps"
}}"""
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Target: '{target_text}'\nTranscribed: '{transcribed_text}'"}
        ]
    )
    
    result = json.loads(response.choices[0].message.content)
    
    # Add Măchiță data to response
    result["romanian_patterns"] = patterns
    result["data_source"] = "Măchiță (2021) dissertation on Romanian L2 English phonology"
    
    return result
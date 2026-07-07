"""
VocaFlow — Shadow Speaking Analysis Service
============================================
Shadow speaking is a technique in SLA research where the learner listens to a
native speaker and immediately repeats the utterance, trying to match rhythm,
intonation, and phoneme accuracy.

Scientific basis:
  - Foster, P. & Tavakoli, P. (2009). Native speakers and task performance:
    comparing effects on complexity, fluency, and lexical diversity.
    Language Learning, 59(4), 866-896.
    → Speech rate (WPM) as a core dimension of utterance fluency; native speaker
      norms provide the benchmark for learner fluency assessment (120-180 WPM).
  - Pallotti, G. (2009). CAF: Defining, refining and differentiating constructs.
    Applied Linguistics, 30(4), 590-601.
    → Complexity, Accuracy, and Fluency (CAF) framework — WPM is the standard
      operationalisation of utterance fluency in SLA research.
  - Saito, K. & Lyster, R. (2012). Effects of form-focused instruction and
    corrective feedback on L2 pronunciation development of /ɹ/ by Japanese
    learners of English. Language Learning, 62(2), 595-633.
    → Explicit phoneme-level feedback improves L2 pronunciation accuracy.
  - Măchiță, O.-M. (2021). The Acquisition of English Phonology by Romanian
    and French Learners of English. University of Bucharest.
    → Romanian-specific phonological transfer patterns used for phoneme feedback.
  - Boersma, P. & van Heuven, V. (2001). Speak and unSpeak with PRAAT.
    Glot International, 5(9/10), 341-347.
    → Praat phonetic framework underlying the acoustic/phoneme analysis.

Metrics computed:
  1. word_accuracy   — difflib word-match (deterministic, no LLM)
  2. wpm             — words/min from Whisper verbose_json timestamps
  3. wpm_assessment  — slow/ideal/fast compared to native speaker norms (120-180 WPM)
  4. phoneme_score   — wav2vec2-espeak via Colab if available
  5. qualitative tips — LLM constrained to computed scores only
"""

from groq import Groq
from dotenv import load_dotenv
import os
import re
import difflib
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── WPM norms per COCA genre ──────────────────────────────────────────────────
# Source: Tauroza & Allison (1990) Speech rates in British English.
#         Applied Linguistics, 11(1), 90-105.
#         Varies by register: academic lectures slower, casual speech faster.
_WPM_NORMS = {
    "spoken":    (140, 165),   # TV/radio: natural conversational pace
    "fiction":   (135, 160),   # Narrated prose: expressive but measured
    "movies":    (135, 165),   # Dialogue: fast, natural
    "tv":        (135, 165),
    "blog":      (130, 155),   # Informal writing read aloud
    "web":       (125, 150),
    "magazine":  (130, 155),   # Feature articles: moderate
    "newspaper": (130, 150),   # News read-aloud: precise
    "academic":  (115, 135),   # Lectures, formal presentations: slower
    "_default":  (120, 180),   # General fallback (Foster & Tavakoli 2009)
}

# Map COCA dominant_group codes → _WPM_NORMS keys
# classify_text_genre returns uppercase COCA codes (SPOK, FIC, ACAD, …)
_COCA_TO_NORM: dict[str, str] = {
    "SPOK": "spoken",
    "FIC":  "fiction",
    "MAG":  "magazine",
    "NEWS": "newspaper",
    "ACAD": "academic",
    "Web":  "web",
    "Blog": "blog",
    "Mov":  "movies",
    "TV":   "tv",
}
_WPM_TOO_SLOW_MARGIN = 20   # subtract from norm low → "too slow" threshold
_WPM_TOO_FAST_MARGIN = 30   # add to norm high → "too fast" threshold

# ── Phonetically similar word pairs (near-miss penalty reduction) ─────────────
# Homophones and near-homophones: if a learner says one of these instead of the
# other, it counts as a "near miss" (50% word penalty instead of 100%).
_NEAR_MISS_PAIRS: list[frozenset] = [
    frozenset({"their", "there", "they're"}),
    frozenset({"to", "too", "two"}),
    frozenset({"of", "off"}),
    frozenset({"a", "the"}),          # function word swap
    frozenset({"an", "the"}),
    frozenset({"its", "it's"}),
    frozenset({"your", "you're"}),
    frozenset({"then", "than"}),
    frozenset({"affect", "effect"}),
    frozenset({"accept", "except"}),
    frozenset({"weather", "whether"}),
    frozenset({"hear", "here"}),
    frozenset({"know", "no"}),
    frozenset({"new", "knew"}),
    frozenset({"right", "write"}),
    frozenset({"been", "bin"}),
    frozenset({"gonna", "going"}),     # weak form
    frozenset({"wanna", "want"}),
    frozenset({"gotta", "got"}),
    frozenset({"kinda", "kind"}),
    frozenset({"cannot", "can't"}),
    frozenset({"do not", "don't"}),
    frozenset({"it is", "it's"}),
    frozenset({"he is", "he's"}),
    frozenset({"she is", "she's"}),
    frozenset({"they are", "they're"}),
    frozenset({"we are", "we're"}),
]

def _near_miss_ratio(w1: str, w2: str) -> bool:
    """
    True if w1 and w2 are in a known near-miss pair OR have high
    character-level similarity (SequenceMatcher ratio ≥ 0.80).
    """
    w1l, w2l = w1.lower(), w2.lower()
    for pair in _NEAR_MISS_PAIRS:
        if w1l in pair and w2l in pair:
            return True
    return difflib.SequenceMatcher(None, w1l, w2l).ratio() >= 0.80

# ── Romanian phoneme patterns (top difficulties for LLM context) ──────────────
_ROMANIAN_PHONEME_CONTEXT = (
    "Key phonological difficulties for Romanian speakers (Măchiță 2021): "
    "/θ/ → /t/ (90% error rate: 'think'→'tink'); "
    "/ð/ → /d/ (95%: 'this'→'dis'); "
    "/u:/ vs /ʊ/ (100%: goose/foot merger); "
    "/i:/ vs /ɪ/ (90%: fleece/kit merger); "
    "dark-L [ɫ] → clear-L (60%: 'milk','feel'); "
    "over-aspiration of /kʰ/ (70%); "
    "/ʌ/ → /a/ (65%: 'cup'→'cap'-like)."
)


def transcribe_audio(audio_file_path: str) -> str:
    """Transcribe via Groq Whisper (text only, no timestamps)."""
    ext = os.path.splitext(audio_file_path)[1].lower() or ".wav"
    audio_mime = {
        ".webm": "audio/webm", ".ogg": "audio/ogg", ".oga": "audio/ogg",
        ".m4a": "audio/mp4",  ".mp4": "audio/mp4", ".mp3": "audio/mpeg",
        ".wav": "audio/wav",  ".flac": "audio/flac",
    }.get(ext, "audio/wav")
    with open(audio_file_path, "rb") as f:
        data = f.read()
    transcription = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(f"recording{ext}", data, audio_mime),
        response_format="text",
        language="en",
    )
    return transcription if isinstance(transcription, str) else getattr(transcription, "text", "")


def transcribe_audio_with_timestamps(audio_file_path: str) -> dict:
    """
    Transcribe via Groq Whisper verbose_json to get segment timestamps.
    Returns {"text": str, "duration_s": float, "wpm": int, "segments": list}.

    Segments are used downstream for pause detection.
    Each segment: {"start": float, "end": float, "text": str}
    """
    ext = os.path.splitext(audio_file_path)[1].lower() or ".wav"
    audio_mime = {
        ".webm": "audio/webm", ".ogg": "audio/ogg", ".oga": "audio/ogg",
        ".m4a": "audio/mp4",  ".mp4": "audio/mp4", ".mp3": "audio/mpeg",
        ".wav": "audio/wav",  ".flac": "audio/flac",
    }.get(ext, "audio/wav")

    with open(audio_file_path, "rb") as f:
        data = f.read()

    result = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(f"recording{ext}", data, audio_mime),
        response_format="verbose_json",
        language="en",
    )

    text     = getattr(result, "text", "") or ""
    raw_segs = getattr(result, "segments", []) or []

    # Groq returns each segment as a dict ({"start":.., "end":.., "text":..});
    # older SDKs return objects. Read both — attribute access alone (getattr) would
    # silently yield 0 on dicts, zeroing out duration/WPM/pause metrics.
    def _seg(s, key, default=0):
        val = s.get(key, default) if isinstance(s, dict) else getattr(s, key, default)
        return default if val is None else val

    segments = [
        {
            "start": float(_seg(s, "start", 0) or 0),
            "end":   float(_seg(s, "end",   0) or 0),
            "text":  str(_seg(s, "text", "") or "").strip(),
        }
        for s in raw_segs
    ]

    duration_s = segments[-1]["end"] if segments else 0.0

    # Fallback: if timestamps are missing/zero, read the real duration straight
    # from the audio so WPM still works (pause metrics need segments, but rate won't be 0).
    if duration_s <= 0:
        try:
            import librosa
            y, _sr = librosa.load(audio_file_path, sr=16000, mono=True)
            duration_s = round(len(y) / 16000, 2)
        except Exception as _dur_err:
            print(f"[transcribe_ts] duration fallback failed: {_dur_err}")

    n_words    = len(text.split()) if text.strip() else 0
    wpm        = round(n_words / duration_s * 60) if duration_s > 0 else 0

    return {
        "text":       text,
        "duration_s": round(duration_s, 2),
        "wpm":        wpm,
        "segments":   segments,
    }


# ── Pause detection ───────────────────────────────────────────────────────────
# Scientific basis:
#   De Jong & Wempe (2009). Praat script to detect syllable nuclei and measure
#     speech rate automatically. Behavior Research Methods, 41(2), 385-390.
#   Tavakoli & Skehan (2005). Strategic planning, task structure, and performance.
#     In Ellis (Ed.), Planning and Task Performance in a Second Language.
#   Pawley & Syder (1983). Two puzzles for linguistic theory: nativelike selection
#     and nativelike fluency. In Richards & Schmidt (Eds.), Language and Communication.
#
# Thresholds (conservative for L2 speech):
#   ≥ 0.25 s  → detectable pause (below this = natural breath / coarticulation)
#   ≥ 0.50 s  → notable pause (may signal hesitation)
#   ≥ 1.00 s  → long pause (significantly disrupts fluency)
#
# Native speaker baseline: Tavakoli & Skehan (2005) — native speakers average
#   0–2 pauses per minute in planned speech; L2 learners average 3–8 per minute.

PAUSE_THRESHOLD_S  = 0.25   # minimum gap to count as a pause
PAUSE_NOTABLE_S    = 0.50   # pause that a listener notices
PAUSE_LONG_S       = 1.00   # clearly disruptive pause

# Native speaker baseline (pauses ≥ 0.25 s, planned speech)
NATIVE_PAUSES_PER_MIN = 2.0


def _analyze_pauses(segments: list, duration_s: float) -> dict:
    """
    Detect inter-segment gaps and compute pause metrics.

    Parameters
    ----------
    segments   : list of {"start": float, "end": float, "text": str}
    duration_s : total audio duration in seconds

    Returns
    -------
    dict with:
      pause_count      — total pauses ≥ PAUSE_THRESHOLD_S
      notable_pauses   — pauses ≥ 0.5 s
      long_pauses      — pauses ≥ 1.0 s
      mean_pause_s     — average pause duration
      max_pause_s      — longest single pause
      pause_rate_per_min
      speech_ratio     — % of time actively speaking (0–100)
      fluency_label    — "fluent" | "some_hesitation" | "hesitant" | "very_hesitant"
      assessment_text  — human-readable description
      pauses_list      — list of {gap_s, after_text} for UI display
      reference        — scientific citation
    """
    if not segments or duration_s <= 0:
        return {
            "pause_count": 0, "notable_pauses": 0, "long_pauses": 0,
            "mean_pause_s": 0.0, "max_pause_s": 0.0,
            "pause_rate_per_min": 0.0, "speech_ratio": 100.0,
            "fluency_label": "unknown", "assessment_text": "Not enough data for pause analysis.",
            "pauses_list": [],
            "reference": "De Jong & Wempe (2009) Behavior Research Methods 41(2)",
        }

    # Detect gaps between consecutive segments
    gaps = []
    for i in range(1, len(segments)):
        gap = segments[i]["start"] - segments[i - 1]["end"]
        if gap >= PAUSE_THRESHOLD_S:
            gaps.append({
                "gap_s":      round(gap, 2),
                "after_text": segments[i - 1]["text"],
            })

    pause_count    = len(gaps)
    notable_pauses = sum(1 for g in gaps if g["gap_s"] >= PAUSE_NOTABLE_S)
    long_pauses    = sum(1 for g in gaps if g["gap_s"] >= PAUSE_LONG_S)
    mean_pause_s   = round(sum(g["gap_s"] for g in gaps) / pause_count, 2) if gaps else 0.0
    max_pause_s    = round(max((g["gap_s"] for g in gaps), default=0.0), 2)

    duration_min       = duration_s / 60
    pause_rate_per_min = round(pause_count / duration_min, 1) if duration_min > 0 else 0.0

    # Speech ratio: total speech time / total duration
    speech_time  = sum(s["end"] - s["start"] for s in segments)
    speech_ratio = round(min(100.0, speech_time / duration_s * 100), 1)

    # Fluency label — compare to native baseline (≤2 pauses/min)
    if pause_rate_per_min <= NATIVE_PAUSES_PER_MIN + 1:
        label = "fluent"
        text  = (
            f"Very few pauses ({pause_count} total, {pause_rate_per_min}/min). "
            "Your rhythm is close to native speaker norms."
        )
    elif pause_rate_per_min <= 5.0:
        label = "some_hesitation"
        text  = (
            f"{pause_count} pauses detected ({pause_rate_per_min}/min). "
            "Some hesitation present — focus on linking words more smoothly."
        )
    elif pause_rate_per_min <= 9.0:
        label = "hesitant"
        text  = (
            f"{pause_count} pauses ({pause_rate_per_min}/min, longest: {max_pause_s}s). "
            "Frequent hesitation. Try shadowing at 0.75x speed first to build rhythm."
        )
    else:
        label = "very_hesitant"
        text  = (
            f"{pause_count} pauses ({pause_rate_per_min}/min, longest: {max_pause_s}s). "
            "Very hesitant delivery. Practise chunking: shadow phrase by phrase, "
            "not word by word."
        )

    return {
        "pause_count":         pause_count,
        "notable_pauses":      notable_pauses,
        "long_pauses":         long_pauses,
        "mean_pause_s":        mean_pause_s,
        "max_pause_s":         max_pause_s,
        "pause_rate_per_min":  pause_rate_per_min,
        "speech_ratio":        speech_ratio,
        "fluency_label":       label,
        "assessment_text":     text,
        "pauses_list":         gaps,
        "reference":           (
            "De Jong & Wempe (2009) Behavior Research Methods 41(2); "
            "Tavakoli & Skehan (2005) in Ellis (Ed.) Planning and Task Performance"
        ),
    }


def _assess_wpm(wpm: int, genre: str = "_default") -> dict:
    """
    Classify speaking rate against register-specific norms.

    Norm sources:
      Tauroza & Allison (1990). Speech rates in British English.
        Applied Linguistics, 11(1), 90-105.  — register variation in WPM.
      Foster & Tavakoli (2009). Language Learning 59(4).  — general fluency norms.
      Pallotti (2009). Applied Linguistics 30(4). — CAF / utterance fluency.
    """
    norm_key  = _COCA_TO_NORM.get(genre, genre.lower() if genre else "_default")
    low, high = _WPM_NORMS.get(norm_key, _WPM_NORMS["_default"])
    too_slow = low  - _WPM_TOO_SLOW_MARGIN
    too_fast = high + _WPM_TOO_FAST_MARGIN
    target   = f"{low}–{high} WPM"

    if wpm == 0:
        return {"label": "unknown", "message": "Could not measure speaking rate.",
                "target": target, "genre_norm": genre}
    elif wpm < too_slow:
        return {
            "label": "too_slow",
            "message": (f"Speaking rate is {wpm} WPM — below the {genre} register norm "
                        f"({target}). Try to match the model's rhythm more closely."),
            "target": target, "genre_norm": genre,
            "reference": "Tauroza & Allison (1990) Applied Linguistics 11(1); Foster & Tavakoli (2009)",
        }
    elif wpm <= high:
        return {
            "label": "ideal",
            "message": f"Speaking rate is {wpm} WPM — within the {genre} register norm ({target}). Good rhythm!",
            "target": target, "genre_norm": genre,
            "reference": "Tauroza & Allison (1990) Applied Linguistics 11(1)",
        }
    elif wpm <= too_fast:
        return {
            "label": "slightly_fast",
            "message": (f"Speaking rate is {wpm} WPM — slightly above the {genre} norm "
                        f"({target}). Slow down a little for clarity."),
            "target": target, "genre_norm": genre,
            "reference": "Tauroza & Allison (1990) Applied Linguistics 11(1)",
        }
    else:
        return {
            "label": "too_fast",
            "message": f"Speaking rate is {wpm} WPM — too fast for clear pronunciation. Aim for {target}.",
            "target": target, "genre_norm": genre,
            "reference": "Tauroza & Allison (1990) Applied Linguistics 11(1)",
        }


def _norm(s: str) -> list:
    """Lowercase, strip punctuation, split into words."""
    return re.sub(r"[^\w\s']", "", s.lower()).split()


def _word_accuracy(transcribed: str, original: str) -> tuple:
    """
    Deterministic word-level accuracy via difflib, with near-miss penalty reduction.

    Scoring:
      exact match  → 1.0 credit
      near-miss    → 0.5 credit (homophones, weak forms, high char-similarity ≥ 0.80)
      missing/extra → 0.0 credit

    Returns (score_0_100, missing_words, extra_words).
    """
    orig_w  = _norm(original)
    trans_w = _norm(transcribed)
    if not orig_w:
        return 0, [], []

    sm = difflib.SequenceMatcher(None, orig_w, trans_w)
    effective_matched = 0.0
    missing: list = []
    extra:   list = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            effective_matched += float(i2 - i1)
        elif tag == "replace":
            orig_chunk  = orig_w[i1:i2]
            trans_chunk = trans_w[j1:j2]
            missing.extend(orig_chunk)
            extra.extend(trans_chunk)
            # For each aligned pair, grant 0.5 credit on near-miss
            for o_w, t_w in zip(orig_chunk, trans_chunk):
                if _near_miss_ratio(o_w, t_w):
                    effective_matched += 0.5
        elif tag == "delete":
            missing.extend(orig_w[i1:i2])
        elif tag == "insert":
            extra.extend(trans_w[j1:j2])

    score = round(100 * effective_matched / len(orig_w))
    return score, missing, extra


def analyze_fluency(transcribed: str, original: str,
                    wpm: int = 0, phoneme_score: int | None = None,
                    segments: list | None = None,
                    duration_s: float = 0.0,
                    genre: str = "_default",
                    prosody_result: dict | None = None) -> dict:
    """
    Fluency analysis combining:
      - word_accuracy    (difflib + near-miss, deterministic)
      - wpm assessment   (genre-aware norms from Tauroza & Allison 1990)
      - pause detection  (inter-segment gaps from Whisper timestamps)
      - phoneme_score    (wav2vec2 via Colab, if available)
      - qualitative tips (LLM, constrained to computed scores)

    Parameters
    ----------
    transcribed   : Whisper transcription of learner's shadow output
    original      : native speaker target text
    wpm           : speaking rate from verbose_json timestamps (0 = unknown)
    phoneme_score : accuracy_score from Colab phoneme server (None = unavailable)
    segments      : list of {"start", "end", "text"} from verbose_json
    duration_s    : total audio duration in seconds
    genre         : dominant COCA genre of `original` (e.g. "academic", "spoken", "_default")
    """
    word_score, missing, extra = _word_accuracy(transcribed, original)
    wpm_info     = _assess_wpm(wpm, genre)
    pause_data   = _analyze_pauses(segments or [], duration_s)

    # Articulation rate (WPM excluding pause time) — standard CAF metric
    # Pallotti (2009): articulation rate = syllables/words per minute of SPEECH time
    # Distinct from overall WPM which includes silent pauses.
    speech_time_s = sum(
        (s["end"] - s["start"]) for s in (segments or [])
    )
    n_words = len(transcribed.split()) if transcribed.strip() else 0
    articulation_rate = (
        round(n_words / speech_time_s * 60) if speech_time_s > 0 else 0
    )

    # Combined overall score — weights follow Pallotti (2009) CAF framework:
    # Accuracy (word + phoneme) + Fluency (prosody + pause) dimensions.
    #
    # With prosody + phoneme:  40% word + 25% phoneme + 25% prosody + 10% pause
    # With prosody only:       50% word + 30% prosody + 20% pause
    # With phoneme only:       50% word + 35% phoneme + 15% pause
    # Baseline:                70% word + 30% pause
    pause_fluency_score = {
        "fluent":          100,
        "some_hesitation":  75,
        "hesitant":         50,
        "very_hesitant":    25,
        "unknown":          None,
    }.get(pause_data["fluency_label"])

    prosody_score = prosody_result.get("prosody_score") if prosody_result else None

    has_ph  = phoneme_score is not None
    has_pr  = prosody_score is not None
    has_pau = pause_fluency_score is not None

    if has_ph and has_pr and has_pau:
        overall = round(0.40 * word_score + 0.25 * phoneme_score
                        + 0.25 * prosody_score + 0.10 * pause_fluency_score)
        score_method = "40% word + 25% phoneme (wav2vec2) + 25% prosody (Praat/DTW) + 10% pause"
    elif has_ph and has_pr:
        overall = round(0.45 * word_score + 0.30 * phoneme_score + 0.25 * prosody_score)
        score_method = "45% word + 30% phoneme + 25% prosody (Praat/DTW)"
    elif has_pr and has_pau:
        overall = round(0.50 * word_score + 0.30 * prosody_score + 0.20 * pause_fluency_score)
        score_method = "50% word + 30% prosody (Praat/DTW) + 20% pause"
    elif has_ph and has_pau:
        overall = round(0.50 * word_score + 0.35 * phoneme_score + 0.15 * pause_fluency_score)
        score_method = "50% word + 35% phoneme (wav2vec2) + 15% pause"
    elif has_ph:
        overall = round(0.60 * word_score + 0.40 * phoneme_score)
        score_method = "60% word + 40% phoneme (wav2vec2)"
    elif has_pr:
        overall = round(0.60 * word_score + 0.40 * prosody_score)
        score_method = "60% word + 40% prosody (Praat/DTW)"
    elif has_pau:
        overall = round(0.70 * word_score + 0.30 * pause_fluency_score)
        score_method = "70% word + 30% pause fluency"
    else:
        overall = word_score
        score_method = "word accuracy (difflib) — all acoustic modules unavailable"

    # WPM penalty: extremely slow speech (letter-by-letter, heavy pausing)
    # cannot score well regardless of word accuracy.
    # Below 40 WPM = clearly unnatural delivery → cap at 55.
    # Below 60 WPM = very hesitant → cap at 70.
    if wpm > 0:
        if wpm < 40:
            overall = min(overall, 55)
        elif wpm < 60:
            overall = min(overall, 70)

    # Qualitative feedback from LLM, constrained to real scores
    fluency_feedback      = ""
    connected_speech_tips = ""
    try:
        phoneme_note = (
            f"Phoneme accuracy: {phoneme_score}/100 (wav2vec2)."
            if phoneme_score is not None else
            "Phoneme server unavailable."
        )
        pause_note = (
            f"Pauses: {pause_data['pause_count']} detected "
            f"({pause_data['pause_rate_per_min']}/min), "
            f"longest {pause_data['max_pause_s']}s — {pause_data['fluency_label']}."
            if pause_data["pause_count"] > 0 else
            "No significant pauses detected."
        )
        genre_label = genre if genre != "_default" else "general"
        prompt = f"""You are a fluency coach for Romanian speakers learning English.
Scores are ALREADY computed — do NOT change them:
  Word accuracy:  {word_score}/100  (missing: {missing})
  Speaking rate:  {wpm} WPM ({wpm_info['label']}, target for {genre_label}: {wpm_info.get('target', 'N/A')})
  {phoneme_note}
  {pause_note}
  Overall:        {overall}/100

Original: '{original}'
Learner said: '{transcribed}'
Register/genre: {genre_label}

Scientific context: In the CAF framework (Pallotti 2009), utterance fluency includes
speech rate (WPM), pausing, and repair. Romanian learners tend to produce more uniform
syllable durations than native English speakers, reducing the stress-timed rhythm.
Native speakers average 0-2 pauses/min in planned speech (Tavakoli & Skehan 2005).
Explicit phoneme feedback (Saito & Lyster 2012) and repeated shadowing practice
help close the gap between learner output and native norms.

{_ROMANIAN_PHONEME_CONTEXT}

Respond ONLY with valid JSON (no markdown):
{{
  "fluency_feedback": "1-2 sentences, encouraging, referencing the pause and accuracy data above",
  "connected_speech_tips": "one specific tip about linking or rhythm for this sentence, targeting Romanian speakers if relevant"
}}"""
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )
        llm = json.loads(resp.choices[0].message.content)
        fluency_feedback      = llm.get("fluency_feedback", "")
        connected_speech_tips = llm.get("connected_speech_tips", "")
    except Exception as e:
        print(f"[analyze_fluency] LLM tip failed: {e}")
        if overall >= 80:
            fluency_feedback = "Great accuracy! Focus on natural stress-timing."
        elif overall >= 55:
            fluency_feedback = "Good attempt. Practise the missing words at 0.5x first."
        else:
            fluency_feedback = "Try at 0.5x speed until word accuracy reaches 80%, then increase."
        connected_speech_tips = (
            "English is stress-timed: stressed syllables should be longer and louder. "
            "Unstressed syllables (like 'the', 'a', 'of') are very short."
        )

    return {
        # Objective metrics
        "accuracy_score":        overall,
        "word_accuracy":         word_score,
        "phoneme_score":         phoneme_score,
        "prosody":               prosody_result,    # pitch + rhythm + energy breakdown
        "wpm":                   wpm,               # overall rate (incl. pauses)
        "articulation_rate":     articulation_rate, # rate excl. pauses (CAF standard)
        "wpm_assessment":        wpm_info,
        # Pause analysis
        "pause_analysis":        pause_data,
        # Word-level detail
        "missing_words":         missing,
        "extra_words":           extra,
        # Qualitative
        "fluency_feedback":      fluency_feedback,
        "connected_speech_tips": connected_speech_tips,
        # Metadata
        "genre":                 genre,
        "score_method":          score_method,
        "scientific_basis": {
            "fluency_measurement":    "Foster & Tavakoli (2009) Language Learning 59(4); Pallotti (2009) CAF framework Applied Linguistics 30(4)",
            "pause_detection":        "De Jong & Wempe (2009) Behavior Research Methods 41(2); Tavakoli & Skehan (2005) in Ellis (Ed.) Planning and Task Performance",
            "pronunciation_feedback": "Saito & Lyster (2012) Language Learning 62(2) — form-focused instruction + corrective feedback",
            "phoneme_patterns":       "Măchiță (2021) — Romanian phonological transfer (University of Bucharest)",
            "phonetic_analysis":      "Boersma & Weenink (2001) Speak and unSpeak with PRAAT, Glot International 5(9/10), 341-347",
            "prosody_pitch":          "Sakoe & Chiba (1978) DTW, IEEE Trans ASSP 26(1); Xu (2005) semitone normalisation, Speech Prosody",
            "prosody_rhythm":         "Ramus et al. (1999) rhythm metrics, Cognition 73(3), 265-292",
            "score_weights":          "Pallotti (2009) CAF — Accuracy + Fluency weighting",
        },
    }

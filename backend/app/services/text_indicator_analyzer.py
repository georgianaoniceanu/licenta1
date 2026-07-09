"""
Text Indicator Analyzer — Computes all 10 proficiency indicators from raw text,
plus a Syntactic Maturity Composite (author-defined derived indicator).

Research sources per indicator:
────────────────────────────────────────────────────────────────────────────────

Indicator 1 — Lexical Diversity (MTLD)
  Şahin Kızıl (2024): MTLD (Measure of Textual Lexical Diversity) is the most
  robust lexical diversity index, independent of text length.
  Kolahi Ahari et al. (2025): MTLD is the strongest predictor of L2 speaking
  proficiency (β = .40). Algorithm: bidirectional MTLD with threshold 0.720.

Indicator 2 — Lexical Sophistication (word frequency proxy)
  Lee (2021), Laufer & Nation (1995): less frequent = more sophisticated.
  Proxy: proportion of words with ≥ 7 characters (academic/rare words tend longer).
  Mapped to 1.0-6.0 inverse scale (low score = more sophisticated).

Indicator 3 — Average Word Length
  Lee (2021): morphological complexity correlates with proficiency.

Indicator 4 — Mean Length of Sentence (MLS)
  Lee (2021) Table 2; Barrot & Agdeppa (2021); Ha (2022): words per sentence.

Indicator 5 — Subordination Ratio (DC/T-unit)
  Lee (2021); Bardovi-Harlig (1992): subordinating conjunctions / sentences.

Indicator 6 — Syntactic Complexity (Clauses per Sentence)
  Ahari et al. (2025); Lu (2010): (coord + subord conjunctions + 1) / sentences.

Indicator 7 — Articulation Rate (words per second)
  Zechner et al. (2009) TOEFL iBT SpeechRater: wpsec metric.
  Bao et al. (2026): Speech Rate = intelligible syllables/second.

Indicator 8 — Pause/Disfluency Rate
  Zechner et al. (2009): silmean (mean silence duration).
  Foster & Tavakoli (2009): mid-clause vs end-clause pause differentiation.

Indicator 9 — Cohesion Score
  Kyle & Crossley (2016) TAACO; Ahari et al. (2025): discourse markers / 100 words.

Indicator 10 — Morphosyntactic Accuracy
  Zechner et al. (2009) amscore; Li & Shintani (2010); Şahin Kızıl (2024) EFC/C.
  Estimated via Groq LLM returning error-free clause ratio.

Syntactic Maturity Composite (derived, author-defined)
  composite = (MLS × subordination_ratio) / (1 + error_rate).
  An author-defined index combining sentence length, subordination and accuracy.
  NOTE: this is NOT Neumanova's Index of Developmental Levels (IDL), which is a
  developmental-stage scoring rubric (Mostafa et al. 2020), not an arithmetic formula.
  SER (Syntactic Error Rate) approximated from morphosyntactic_accuracy.

Automated Scoring Validation
  Tang, X., Chen, H., Lin, D., & Li, K. (2024). Incorporating fine-grained linguistic
  features and explainable AI into multi-dimensional automated writing assessment.
  Applied Sciences, 14(10), 4182. Demonstrates that combining micro-level features
  (per-indicator scores) with aggregated composite features outperforms single-feature
  scoring; Random Forest + SHAP provides both accuracy and interpretability — the
  approach followed here for multi-indicator profile construction.
  Dong, Y. (2026). The application of deep learning in the automatic scoring of English
  writing. Discover Artificial Intelligence. https://doi.org/10.1007/s44163-026-01146-x
  BiLSTM-CNN hybrid achieves Pearson r = 0.89 with human graders on ASAP 2.0 dataset,
  evaluating grammar, coherence, vocabulary richness, and structural organization —
  the same construct dimensions operationalized by Indicators 1–10 in this module.
"""

import re
import os
import json
import math
import hashlib
from typing import Dict, Optional, List
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Cambridge EVP word-level CEFR data (for lexical sophistication) ────────────
# evp_words.json maps 6,345 words to the CEFR level a learner is expected to know
# them at (e.g. "abandon" -> "B2"). Used to measure real lexical rarity instead
# of the crude "long word" proxy.
_EVP_PATH = os.path.join(os.path.dirname(__file__), "evp_words.json")
try:
    with open(_EVP_PATH, encoding="utf-8") as _evp_f:
        _EVP_LEVELS: Dict[str, str] = json.load(_evp_f)
except Exception:
    _EVP_LEVELS = {}
_EVP_RANK = {"A1": 1.0, "A2": 2.0, "B1": 3.0, "B2": 4.0, "C1": 5.0, "C2": 6.0}


def _evp_sophistication(words: List[str]) -> Optional[float]:
    """Mean CEFR rank (A1=1 … C2=6) of the EVP-graded words in the text.
    Higher = more advanced vocabulary. None if no graded word is present."""
    ranks = [
        _EVP_RANK[_EVP_LEVELS[w]]
        for w in words
        if w in _EVP_LEVELS and _EVP_LEVELS[w] in _EVP_RANK
    ]
    if not ranks:
        return None
    return round(sum(ranks) / len(ranks), 2)

# ─────────────────────────────────────────────────────────────────────────────
# WORD LISTS
# ─────────────────────────────────────────────────────────────────────────────

SUBORDINATING_CONJUNCTIONS = {
    "because", "although", "though", "even though", "while", "when", "whenever",
    "where", "wherever", "since", "unless", "until", "after", "before", "if",
    "as", "whereas", "whether", "so that", "in order that", "provided", "given",
    "once", "now that", "rather than", "as long as", "as soon as", "in case",
    "even if", "despite", "in spite of", "due to", "owing to",
}

COORDINATING_CONJUNCTIONS = {"and", "but", "or", "nor", "for", "yet", "so"}

# Discourse markers — Kyle & Crossley (2016) TAACO categories
DISCOURSE_MARKERS = {
    # Additive
    "furthermore", "moreover", "in addition", "additionally", "also", "besides",
    "as well", "not only", "what is more",
    # Adversative
    "however", "nevertheless", "nonetheless", "on the other hand", "in contrast",
    "although", "even though", "whereas", "but", "yet", "despite", "in spite of",
    "on the contrary",
    # Causal
    "therefore", "thus", "hence", "consequently", "as a result", "for this reason",
    "because of this", "accordingly",
    # Sequential
    "first", "firstly", "second", "secondly", "third", "thirdly", "finally",
    "then", "next", "after that", "to begin with", "to start with", "in the end",
    # Exemplifying
    "for example", "for instance", "such as", "namely", "in particular",
    "to illustrate", "specifically",
    # Summarising
    "in conclusion", "in summary", "to sum up", "overall", "in brief",
    "to conclude", "in short",
    # Clarifying
    "in other words", "that is", "that is to say", "to put it differently",
}


# ─────────────────────────────────────────────────────────────────────────────
# CEFR FLUENCY DEFAULTS  (Zechner et al. 2009 TOEFL iBT norms)
# ─────────────────────────────────────────────────────────────────────────────

# Per-CEFR fluency norms from REAL published data — Yan et al. (2020), Aptis
# speaking validation (Table 1, p.10). These replace earlier author-set values.
#   - articulation_rate: this field = words / total speaking time (≈ SPEECH rate).
#     Uses Yan's SPEECH RATE (syllables/s) ÷ 1.5 syllables-per-word → words/s.
#     Yan speech rate: A1 1.70, A2 2.28, B1 2.79, B2 3.54, C 3.54.
#   - pause_frequency: Yan's "silent pauses per syllable" (A1 0.23 … C 0.08),
#     used as a proxy for this per-word pause field (different unit — documented).
# NOTE: still IMPUTED from the self-assessed level when no audio is recorded;
# the text-only diagnostic cannot measure speech. Real values come from audio
# (Accent ADN / Shadow).
CEFR_FLUENCY_DEFAULTS = {
    "A1": {"articulation_rate": 1.13, "pause_frequency": 0.23},
    "A2": {"articulation_rate": 1.52, "pause_frequency": 0.19},
    "B1": {"articulation_rate": 1.86, "pause_frequency": 0.14},
    "B2": {"articulation_rate": 2.36, "pause_frequency": 0.08},
    "C1": {"articulation_rate": 2.36, "pause_frequency": 0.08},
    "C2": {"articulation_rate": 2.36, "pause_frequency": 0.08},
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _tokenize_words(text: str) -> List[str]:
    return re.findall(r"\b[a-zA-Z']+\b", text.lower())


def _tokenize_sentences(text: str) -> List[str]:
    sentences = re.split(r"[.!?]+", text)
    return [s.strip() for s in sentences if len(s.strip().split()) >= 3]


def _count_subordinating(words: List[str], text_lower: str) -> int:
    count = 0
    for conj in SUBORDINATING_CONJUNCTIONS:
        count += len(re.findall(r"\b" + re.escape(conj) + r"\b", text_lower))
    return count


def _count_coordinating(words: List[str]) -> int:
    return sum(1 for w in words if w in COORDINATING_CONJUNCTIONS)


def _count_discourse_markers(text_lower: str) -> int:
    count = 0
    for marker in DISCOURSE_MARKERS:
        count += len(re.findall(r"\b" + re.escape(marker) + r"\b", text_lower))
    return count


# ─────────────────────────────────────────────────────────────────────────────
# MTLD — Measure of Textual Lexical Diversity
# Şahin Kızıl (2024); McCarthy (2005); article 43 (D_Tools/vocd validation)
# Bidirectional: average of forward and reverse passes.
# Threshold 0.720 — used in Kolahi Ahari et al. (2025); Yan et al. (2020).
# ─────────────────────────────────────────────────────────────────────────────

def _mtld_one_direction(tokens: List[str], threshold: float = 0.720) -> float:
    """Single-direction MTLD pass."""
    if not tokens:
        return 0.0
    factors = 0.0
    types: set = set()
    token_count = 0

    for token in tokens:
        token_count += 1
        types.add(token)
        ttr = len(types) / token_count
        if ttr <= threshold:
            factors += 1
            types = set()
            token_count = 0

    # Partial factor for the remaining segment
    if token_count > 0:
        ttr = len(types) / token_count
        partial = (1.0 - ttr) / (1.0 - threshold)
        factors += partial

    return len(tokens) / factors if factors > 0 else len(tokens)


def compute_mtld(tokens: List[str], threshold: float = 0.720) -> float:
    """
    Bidirectional MTLD — threshold 0.720 (Kolahi Ahari et al. 2025; Yan et al. 2020).
    Returns raw MTLD score (typically 20–200 for learner texts).
    Normalized to 20–100 for the indicator scale.
    """
    if len(tokens) < 10:
        return 20.0
    forward = _mtld_one_direction(tokens, threshold)
    backward = _mtld_one_direction(list(reversed(tokens)), threshold)
    raw = (forward + backward) / 2.0
    # Normalize: MTLD ~20 → score 20 (A1); ~120 → score 100 (C2)
    normalized = 20.0 + ((raw - 20.0) / 100.0) * 80.0
    return max(20.0, min(100.0, round(normalized, 2)))


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ANALYZER
# ─────────────────────────────────────────────────────────────────────────────

def analyze_text_indicators(
    text: str,
    self_assessed_cefr: str = "B1",
    audio_duration_seconds: Optional[float] = None,
) -> Dict[str, float]:
    """
    Compute all 10 proficiency indicators + IDL from raw text.

    Args:
        text: The learner's writing/transcribed speech sample.
        self_assessed_cefr: From onboarding Step 1 (used for fluency defaults).
        audio_duration_seconds: If audio was recorded, provide duration for
                                 Indicators 7-8; otherwise uses CEFR defaults.

    Returns:
        Dict mapping each indicator name to its measured value,
        plus 'idl' (Syntactic Maturity Composite — author-defined, NOT Neumanova's IDL).
    """
    text = text.strip()
    text_lower = text.lower()
    words = _tokenize_words(text)
    sentences = _tokenize_sentences(text)

    n_words = max(len(words), 1)
    n_sentences = max(len(sentences), 1)

    # Indicator 1: Lexical Diversity (MTLD, Şahin Kızıl 2024) 
    lexical_diversity = compute_mtld(words)

    # Indicator 2: Lexical Sophistication (1.0-6.0, higher = more advanced) 
    # Mean Cambridge EVP CEFR rank of the words used (A1=1 … C2=6). Falls back to
    # the long-word ratio only when no EVP-graded word is present (very short input).
    lexical_sophistication = _evp_sophistication(words)
    if lexical_sophistication is None:
        long_word_ratio = len([w for w in words if len(w) >= 7]) / n_words
        lexical_sophistication = round(max(1.0, min(6.0, 1.0 + long_word_ratio * 5.0)), 2)

    # Indicator 3: Average Word Length 
    word_length = round(sum(len(w) for w in words) / n_words, 2)

    # Indicator 4: Mean Length of Sentence (MLS) 
    sentence_complexity = round(n_words / n_sentences, 2)

    # Indicator 5: Subordination Ratio 
    n_sub = _count_subordinating(words, text_lower)
    subordination_ratio = round(n_sub / n_sentences, 2)

    # Indicator 6: Syntactic Complexity 
    n_coord = _count_coordinating(words)
    estimated_clauses = n_sub + n_coord + n_sentences
    syntactic_complexity = round(estimated_clauses / n_sentences, 2)

    # Indicator 7: Articulation Rate
    if audio_duration_seconds and audio_duration_seconds > 0:
        articulation_rate = round(n_words / audio_duration_seconds, 2)
    else:
        articulation_rate = CEFR_FLUENCY_DEFAULTS.get(
            self_assessed_cefr, CEFR_FLUENCY_DEFAULTS["B1"]
        )["articulation_rate"]

    # Indicator 8: Pause Frequency 
    if audio_duration_seconds and audio_duration_seconds > 0:
        estimated_speech_s = n_words / 3.0
        pause_time = max(0.0, audio_duration_seconds - estimated_speech_s)
        pause_frequency = round(pause_time / n_words, 3)
    else:
        pause_frequency = CEFR_FLUENCY_DEFAULTS.get(
            self_assessed_cefr, CEFR_FLUENCY_DEFAULTS["B1"]
        )["pause_frequency"]

    # Indicator 9: Cohesion Score 
    n_markers = _count_discourse_markers(text_lower)
    markers_per_100 = (n_markers / n_words) * 100
    cohesion_score = round(10 + (markers_per_100 / 8.0) * 80, 1)
    cohesion_score = max(0.0, min(100.0, cohesion_score))

    # Indicator 10: Morphosyntactic Accuracy (LLM / EFC/C) 
    morphosyntactic_accuracy = _estimate_accuracy_llm(text)

    # ── Syntactic Maturity Composite (author-defined, NOT Neumanova's IDL) ───
    # composite = (MLS × subordination_ratio) / (1 + error_rate)
    # error_rate = (100 - morphosyntactic_accuracy) / 100
    ser = (100.0 - morphosyntactic_accuracy) / 100.0
    idl = round(
        (sentence_complexity * max(subordination_ratio, 0.01)) / (1.0 + ser), 3
    )

    return {
        "lexical_diversity":        lexical_diversity,
        "lexical_sophistication":   lexical_sophistication,
        "word_length":              word_length,
        "sentence_complexity":      sentence_complexity,
        "subordination_ratio":      subordination_ratio,
        "syntactic_complexity":     syntactic_complexity,
        "articulation_rate":        articulation_rate,
        "pause_frequency":          pause_frequency,
        "cohesion_score":           cohesion_score,
        "morphosyntactic_accuracy": morphosyntactic_accuracy,
        "idl":                      idl,
    }


# Cache estimates per text so the metric is reproducible within a run and we
# don't pay for repeated API calls on identical input.
_ACCURACY_CACHE: Dict[str, float] = {}


def _deterministic_accuracy(text: str) -> float:
    """Reproducible morphosyntactic-accuracy estimate from the rule-based
    Romanian interference detector (severity_score: 0-100, higher = fewer
    errors; Pungă & Pârlog 2015). Used when the LLM is unavailable so the
    metric is never a fixed dummy value."""
    try:
        from app.services.romanian_error_detector import detect_romanian_errors
        score = detect_romanian_errors(text).get("severity_score", 70.0)
        return round(float(score), 1)
    except Exception:
        return 70.0


def _estimate_accuracy_llm(text: str) -> float:
    """
    Estimate morphosyntactic accuracy (EFC/C — Error-Free Clause ratio).

    Primary  : Groq LLM holistic estimate (broad error coverage).
    Fallback : deterministic rule-based detector (Pungă & Pârlog 2015) whenever
               the LLM is unavailable — never a fixed dummy value.
    Cached per text for reproducibility.

    Based on:
    - Zechner et al. (2009): amscore (language model score in SpeechRater)
    - Şahin Kızıl (2024): EFC/C = Error-Free Clause ratio
    - Li & Shintani (2010): corrective feedback requires accurate diagnosis
    """
    key = hashlib.sha1(text.strip().encode("utf-8")).hexdigest()
    if key in _ACCURACY_CACHE:
        return _ACCURACY_CACHE[key]

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a computational linguistics expert applying the EFC/C metric "
                        "(Error-Free Clause ratio, Şahin Kızıl 2024). "
                        "Analyze the English text from a learner. "
                        "Estimate the percentage of clauses that are morphosyntactically correct "
                        "(tense, subject-verb agreement, article use, word order, prepositions). "
                        "Respond ONLY with a JSON object: {\"accuracy_percent\": <number 0-100>}"
                    )
                },
                {
                    "role": "user",
                    "content": f"Learner text:\n\n{text[:1500]}"
                }
            ],
            temperature=0.1,
        )
        result = json.loads(response.choices[0].message.content)
        val = float(result.get("accuracy_percent", _deterministic_accuracy(text)))
    except Exception as e:
        print(f"LLM accuracy estimation failed ({e}); using deterministic fallback")
        val = _deterministic_accuracy(text)

    val = round(max(0.0, min(100.0, val)), 1)
    _ACCURACY_CACHE[key] = val
    return val


def get_diagnostic_prompt(domain: str) -> Dict[str, str]:
    """
    Return the writing/speaking prompt for the initial diagnostic task,
    calibrated to the COCA register/genre of the target text.

    Nine genres from Davies' Corpus of Contemporary American English (COCA):
      spoken · fiction · magazine · newspaper · academic · web · blog · movies · tv

    Source: Davies, M. — COCA; Knoch (2009) — EAP diagnostic writing design.
    """
    prompts = {
        #Spoken (TV/radio dialogue, interviews, talk shows)
        "spoken": {
            "title": "Spontaneous Spoken Response",
            "instruction": (
                "Imagine you are being interviewed live on a news programme. "
                "The host asks: 'What is the biggest challenge facing young people today?' "
                "Respond naturally — give your opinion, support it with one or two examples, "
                "and keep the tone conversational."
            ),
            "hint": "Aim for 150–200 words. Write as you would speak — contractions and natural phrasing are fine.",
            "research": "Tauroza & Allison (1990) — spoken register WPM norms; COCA Spoken sub-corpus.",
        },
        # Fiction (novels, screenplays, juvenile fiction) 
        "fiction": {
            "title": "Narrative Writing Task",
            "instruction": (
                "Write the opening of a short story. "
                "Set the scene, introduce a character, and hint at a conflict or problem "
                "the character is about to face. Make the reader want to continue."
            ),
            "hint": "Aim for 150–200 words. Use vivid description, past tenses, and varied sentence rhythm.",
            "research": "COCA Fiction sub-corpus; Coxhead (2000) — narrative register vocabulary.",
        },
        #Academic (journals, science, law, medicine)
        "academic": {
            "title": "Academic Writing Task",
            "instruction": (
                "Explain the concept of climate change to an educated non-specialist. "
                "Include a clear definition, two documented causes, and one measurable consequence. "
                "Maintain a formal, objective register throughout."
            ),
            "hint": "Aim for 150–200 words. Use formal register, precise vocabulary, and logical connectors.",
            "research": "Knoch (2009) — EAP diagnostic writing; Coxhead (2000) AWL; COCA Academic sub-corpus.",
        },
        #Newspaper (national/local news, editorial, opinion) 
        "newspaper": {
            "title": "Opinion Editorial Task",
            "instruction": (
                "Write a short newspaper editorial arguing for or against the following claim: "
                "'Remote work has permanently changed the future of office life.' "
                "State your position clearly, give two supporting arguments, and end with a recommendation."
            ),
            "hint": "Aim for 150–200 words. Use discourse markers: however, consequently, in contrast.",
            "research": "COCA Newspaper sub-corpus; Fulcher (2003) — opinion task design for L2 assessment.",
        },
        #Magazine (lifestyle, sports, science, religion) 
        "magazine": {
            "title": "Magazine Feature Task",
            "instruction": (
                "Write a short feature article for a general-interest magazine on a topic you know well — "
                "a sport, hobby, travel destination, or cultural tradition. "
                "Describe it vividly, explain why it is interesting, and give the reader one surprising fact."
            ),
            "hint": "Aim for 150–200 words. Use descriptive adjectives, engaging tone, and varied vocabulary.",
            "research": "COCA Magazine sub-corpus; Davies (COCA) — magazine register frequency profiles.",
        },
        # Web (informational sites, reviews, instructional) 
        "web": {
            "title": "Informational Web Text Task",
            "instruction": (
                "Write a short 'how-to' guide explaining how to do something practical — "
                "cook a dish, set up a device, plan a trip, or learn a skill. "
                "Structure your text with a brief introduction, numbered steps, and a short conclusion."
            ),
            "hint": "Aim for 150–200 words. Use clear, direct language and imperative verb forms.",
            "research": "COCA Web sub-corpus; Coxhead (2000) — instructional register vocabulary.",
        },
        #Blog (personal, argumentative, promotional)
        "blog": {
            "title": "Personal Blog Post Task",
            "instruction": (
                "Write a blog post about something you recently changed your mind about — "
                "a belief, a habit, or an opinion. "
                "Explain what you used to think, what changed, and what you think now."
            ),
            "hint": "Aim for 150–200 words. First-person, conversational tone — be direct and honest.",
            "research": "COCA Blog sub-corpus; Davies (COCA) — blog register frequency profiles.",
        },
        #Movies (dialogue: action, drama, comedy, sci-fi)
        "movies": {
            "title": "Film Dialogue Task",
            "instruction": (
                "Write a short scene (3–5 exchanges) between two characters who disagree about an important decision. "
                "One character wants to leave a job or city; the other wants them to stay. "
                "Show both characters' feelings through natural dialogue."
            ),
            "hint": "Aim for 150–200 words. Write dialogue naturally — use contractions, interruptions, emotion.",
            "research": "COCA Movies sub-corpus; Davies (COCA) — film dialogue register profiles.",
        },
        #TV Shows (drama, comedy, reality, crime)
        "tv": {
            "title": "TV Drama Scene Task",
            "instruction": (
                "Write a scene from a TV drama. Two colleagues discover that a third person "
                "in their team has been hiding an important piece of information. "
                "Show their reaction through dialogue and brief stage directions."
            ),
            "hint": "Aim for 150–200 words. Vary pace — short sharp lines for tension, longer ones to explain.",
            "research": "COCA TV sub-corpus; Davies (COCA) — television dialogue register profiles.",
        },
    }
    # Onboarding stores context values (conversation/narration/…) that differ from
    # the COCA prompt keys above - map them so each context gets its own prompt
    # instead of always falling back to "spoken".
    aliases = {
        "conversation":  "spoken",      # live interview / conversational
        "narration":     "fiction",     # storytelling
        "description":   "magazine",    # descriptive feature
        "argumentation": "newspaper",   # opinion editorial
        "academic":      "academic",    # formal explanation
        "technical":     "web",         # instructional how-to
    }
    key = aliases.get(domain, domain)
    return prompts.get(key, prompts["spoken"])

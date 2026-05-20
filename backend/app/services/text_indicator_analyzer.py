"""
Text Indicator Analyzer — Computes all 10 proficiency indicators from raw text,
plus IDL (Index of Developmental Levels) as a composite derived indicator.

Research sources per indicator:
────────────────────────────────────────────────────────────────────────────────

Indicator 1 — Lexical Diversity (MTLD)
  Şahin Kızıl (2024): MTLD (Measure of Textual Lexical Diversity) is the most
  robust lexical diversity index, independent of text length.
  Article 43 (McCarthy & Jarvis 2010): vocd/MTLD validated on L2 learner corpora.
  Algorithm: bidirectional MTLD with threshold 0.720 (McCarthy 2005).

Indicator 2 — Lexical Sophistication (word frequency proxy)
  Lee (2021), Laufer & Nation (1995): less frequent = more sophisticated.
  Proxy: proportion of words with ≥ 7 characters (academic/rare words tend longer).
  Mapped to 1.0-6.0 inverse scale (low score = more sophisticated).

Indicator 3 — Average Word Length
  Lee (2021): morphological complexity correlates with proficiency.

Indicator 4 — Mean Length of Sentence (MLS)
  Lee (2021) Table 2; Norris & Ortega (2009); Ha (2022): words per sentence.

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

IDL — Index of Developmental Levels (derived)
  Neumanova (2025): IDL = (MLS × subordination_ratio) / (1 + error_rate).
  Separates CEFR levels more reliably than any single indicator.
  SER (Syntactic Error Rate) approximated from morphosyntactic_accuracy.
"""

import re
import os
import json
import math
from typing import Dict, Optional, List
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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

CEFR_FLUENCY_DEFAULTS = {
    "A1": {"articulation_rate": 1.2, "pause_frequency": 0.80},
    "A2": {"articulation_rate": 1.5, "pause_frequency": 0.60},
    "B1": {"articulation_rate": 2.0, "pause_frequency": 0.40},
    "B2": {"articulation_rate": 2.5, "pause_frequency": 0.25},
    "C1": {"articulation_rate": 3.0, "pause_frequency": 0.15},
    "C2": {"articulation_rate": 3.5, "pause_frequency": 0.10},
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
# Threshold 0.720 is the standard value from McCarthy & Jarvis (2010).
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
    Bidirectional MTLD (McCarthy & Jarvis 2010).
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
        plus 'idl' (Index of Developmental Levels, Neumanova 2025).
    """
    text = text.strip()
    text_lower = text.lower()
    words = _tokenize_words(text)
    sentences = _tokenize_sentences(text)

    n_words = max(len(words), 1)
    n_sentences = max(len(sentences), 1)

    # ── Indicator 1: Lexical Diversity (MTLD, Şahin Kızıl 2024) ──────────────
    lexical_diversity = compute_mtld(words)

    # ── Indicator 2: Lexical Sophistication (1.0-6.0) ─────────────────────────
    long_words = [w for w in words if len(w) >= 7]
    long_word_ratio = len(long_words) / n_words
    lexical_sophistication = round(5.8 - (long_word_ratio * 7.67), 2)
    lexical_sophistication = max(1.0, min(6.0, lexical_sophistication))

    # ── Indicator 3: Average Word Length ─────────────────────────────────────
    word_length = round(sum(len(w) for w in words) / n_words, 2)

    # ── Indicator 4: Mean Length of Sentence (MLS) ───────────────────────────
    sentence_complexity = round(n_words / n_sentences, 2)

    # ── Indicator 5: Subordination Ratio ─────────────────────────────────────
    n_sub = _count_subordinating(words, text_lower)
    subordination_ratio = round(n_sub / n_sentences, 2)

    # ── Indicator 6: Syntactic Complexity ────────────────────────────────────
    n_coord = _count_coordinating(words)
    estimated_clauses = n_sub + n_coord + n_sentences
    syntactic_complexity = round(estimated_clauses / n_sentences, 2)

    # ── Indicator 7: Articulation Rate ───────────────────────────────────────
    if audio_duration_seconds and audio_duration_seconds > 0:
        articulation_rate = round(n_words / audio_duration_seconds, 2)
    else:
        articulation_rate = CEFR_FLUENCY_DEFAULTS.get(
            self_assessed_cefr, CEFR_FLUENCY_DEFAULTS["B1"]
        )["articulation_rate"]

    # ── Indicator 8: Pause Frequency ─────────────────────────────────────────
    if audio_duration_seconds and audio_duration_seconds > 0:
        estimated_speech_s = n_words / 3.0
        pause_time = max(0.0, audio_duration_seconds - estimated_speech_s)
        pause_frequency = round(pause_time / n_words, 3)
    else:
        pause_frequency = CEFR_FLUENCY_DEFAULTS.get(
            self_assessed_cefr, CEFR_FLUENCY_DEFAULTS["B1"]
        )["pause_frequency"]

    # ── Indicator 9: Cohesion Score ───────────────────────────────────────────
    n_markers = _count_discourse_markers(text_lower)
    markers_per_100 = (n_markers / n_words) * 100
    cohesion_score = round(10 + (markers_per_100 / 8.0) * 80, 1)
    cohesion_score = max(0.0, min(100.0, cohesion_score))

    # ── Indicator 10: Morphosyntactic Accuracy (LLM / EFC/C) ─────────────────
    morphosyntactic_accuracy = _estimate_accuracy_llm(text)

    # ── IDL: Index of Developmental Levels (Neumanova 2025) ──────────────────
    # IDL = (MLS × subordination_ratio) / (1 + SER)
    # SER (Syntactic Error Rate) = (100 - morphosyntactic_accuracy) / 100
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


def _estimate_accuracy_llm(text: str) -> float:
    """
    Use Groq LLM to estimate morphosyntactic accuracy (EFC/C ratio).

    Based on:
    - Zechner et al. (2009): amscore (language model score in SpeechRater)
    - Şahin Kızıl (2024): EFC/C = Error-Free Clause ratio
    - Li & Shintani (2010): corrective feedback effectiveness requires accurate diagnosis
    """
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
        return float(result.get("accuracy_percent", 70.0))
    except Exception as e:
        print(f"LLM accuracy estimation failed: {e}")
        return 70.0


def get_diagnostic_prompt(domain: str) -> Dict[str, str]:
    """
    Return the writing/speaking prompt for the initial diagnostic task.
    Based on Dimova (2022) task types and Knoch (2009) diagnostic writing design.
    """
    prompts = {
        "narration": {
            "title": "Narration Task",
            "instruction": (
                "Tell the story of a memorable experience from your life — "
                "a trip, an event, or a moment that stayed with you. "
                "Describe what happened, who was there, and why it was important to you."
            ),
            "hint": "Aim for 150–200 words. Use past tenses and describe events in order.",
            "research": "Dimova (2022) — monologic narrative task; Fulcher (2003) narration design.",
        },
        "description": {
            "title": "Description Task",
            "instruction": (
                "Describe your hometown or a place you know very well. "
                "Include details about its appearance, atmosphere, what makes it special, "
                "and what someone visiting for the first time should see."
            ),
            "hint": "Aim for 150–200 words. Use descriptive adjectives and varied vocabulary.",
            "research": "Dimova (2022) — descriptive task characteristics.",
        },
        "argumentation": {
            "title": "Opinion & Argumentation Task",
            "instruction": (
                "Do you think social media has more positive or negative effects on society? "
                "Give your opinion and support it with at least two arguments and examples."
            ),
            "hint": "Aim for 150–200 words. Use discourse connectors: however, therefore, furthermore.",
            "research": "Dimova (2022) — argumentative monologic task; Fulcher (2003) opinion tasks.",
        },
        "conversation": {
            "title": "Spontaneous Response Task",
            "instruction": (
                "Imagine you are meeting a new colleague for the first time. "
                "Introduce yourself, explain what you do, what your interests are, "
                "and ask them two questions you would naturally want to know."
            ),
            "hint": "Aim for 150–200 words. Write naturally, as if speaking.",
            "research": "Dimova (2022) — interactional task design.",
        },
        "academic": {
            "title": "Academic Writing Task",
            "instruction": (
                "Explain the concept of artificial intelligence to someone who has never "
                "heard of it. Include a definition, two real-world applications, "
                "and one potential concern about its use."
            ),
            "hint": "Aim for 150–200 words. Use formal register and precise vocabulary.",
            "research": "Knoch (2009) — EAP diagnostic writing; Present-Thomas et al. (2013).",
        },
        "technical": {
            "title": "Technical Explanation Task",
            "instruction": (
                "Describe a process or procedure in your area of expertise or study. "
                "Explain the steps clearly, use accurate terminology, "
                "and include the purpose of each main step."
            ),
            "hint": "Aim for 150–200 words. Use domain-specific vocabulary precisely.",
            "research": "Coxhead (2000) Academic Word List — specialized vocabulary.",
        },
    }
    return prompts.get(domain, prompts["description"])

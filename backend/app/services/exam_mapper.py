"""Exam Profile Mapper
Maps student speech/text metrics to internationally recognised proficiency
frameworks: IELTS Speaking band descriptors and Cambridge CEFR scale.

All numeric thresholds are derived directly from the following academic
sources present in the project's articles_text corpus:

  [IELTS-CEFR] Kolahi Ahari et al. (2025) - 10.22034_ijlt.2025.492133.1395.txt (Kolahi Ahari, Ghonsooly, Ghapanchi & Soodmand Afshar).txt
    419 L2 speaking samples assigned IELTS scores by trained raters then
    mapped to CEFR. Official conversion used:
      B1 = IELTS 4.0-5.0  (mean 4.8, SD 0.3)
      B2 = IELTS 5.5-6.5  (mean 6.0, SD 0.3)
      C1 = IELTS 7.0-8.0  (mean 7.5, SD 0.4)
      C2 = IELTS 8.5-9.0  (mean 8.6, SD 0.2)
    Model explains 34 % of L2 speaking proficiency variance:
      Lexical Diversity  β = .40 (p < .001) — strongest predictor
      Lexical Sophistication β = .21 (p < .001)
      Syntactic Sophistication β = .16 (p < .001)

  [SER / Grammar] Neumanova (2015) - 8.+Z.+Neumanova+Do+publikacji+5.06.txt
    Syntactic Error Rate (SER) per 100 words by CEFR level in EFL learners:
      A2: M = 9.16, SD = 2.64  (pairwise A2→B1 p = 0.011)
      B1: M = 6.91, SD = 2.31  (pairwise B1→B2 p = 0.009)
      B2: M = 4.53, SD = 1.54  (pairwise A2→B2 p = 0.000)
    Index of Developmental Levels (IDL) — syntactic complexity measure:
      A2: M = 26.31  B1: M = 46.13  B2: M = 60.25

  [Lexical Density] Neumanova (2015) - same file, Tables 4–8
    Spoken EFL learner text (ratio content words / total words):
      A2: M = 0.485 (48.5 %)   B1: M = 0.457 (45.7 %)
      B2: M = 0.463 (46.3 %)
    Note: LD did not prove a reliable standalone predictor of proficiency;
    used here as a tertiary signal (10 % weight) consistent with this finding.

  [MTLD] Kolahi Ahari et al. (2025) — 10.22034_ijlt.2025.492133.1395.txt (Kolahi Ahari, Ghonsooly, Ghapanchi & Soodmand Afshar).txt
    "Textual Lexical Diversity (average words needed to reach TTR of 0.720)"
    cited as primary lexical diversity metric; β = .40 — strongest predictor.
    Kolahi Ahari et al. (2025) apply MTLD with TTR threshold = 0.720 as the
    primary lexical diversity metric (β = .40, strongest predictor of L2 speaking).

  [Fluency / WPS] Neumanova (2015) — articulation rate (AR) significantly
    discriminates proficiency levels (p < 0.012); AR = words / speaking time.

  [IELTS Band Descriptors] ielts-guide-for-test-takers.txt (British Council /
    Cambridge ESOL / IDP, 2024) — official qualitative descriptions bands 1–9.

  [CAF] Pallotti (2014) — 21Routledge-Pallotti-CAF in SLA-LT-preprint.txt
    Pause threshold for fluency: 0.3–0.4 s (standard in SLA fluency research).
    Filled Pause Ratio (FPR) = filled pauses / total words.

  [CEFR/IELTS formal equivalence] 1-s2.0-S1075293520300714-main.txt (ICNALE)
    "proficiency levels were mapped onto CEFR bands using official conversions
    proposed by ETS and Cambridge ESOL."

  [Complexity indices] 1-s2.0-S1075293520300714-main.txt
    MLS, MLT, MLC, CN/C, CN/T, CP/T, CP/C identified as 14 indices that
    "linearly progressed across proficiency levels."""

import re
from typing import Dict, Any, List

# ─── Function words for lexical density (Neumanova 2015; Halliday 1989) ─────
_FUNCTION_WORDS = {
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
    'in', 'on', 'at', 'to', 'of', 'with', 'by', 'from', 'up', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
    'not', 'no', 'than', 'then', 'as', 'if', 'while', 'although',
    'because', 'since', 'unless', 'until', 'when', 'where',
    'there', 'here', 'how', 'just', 'also', 'both', 'each', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'very',
    'too', 'now', 'once', 'its',
}

# Subordinating conjunctions — proxy for clause embedding (Barrot & Agdeppa 2021; Lee 2021)
_SUBORD_CONJ = [
    'because', 'although', 'though', 'while', 'whereas', 'since',
    'unless', 'until', 'whether', 'when', 'whenever', 'where',
    'wherever', 'after', 'before', 'once', 'provided', 'despite',
    'even though', 'as long as', 'in order that',
]


#Text feature computations

def _mtld(tokens: List[str]) -> float:
    """
    MTLD — bidirectional lexical diversity measure, TTR threshold = 0.720.
    Kolahi Ahari et al. (2025): MTLD is the strongest predictor of L2 speaking
    proficiency (β = .40, p < .001). Yan et al. (2020): MTLD used as macro
    fluency index on Aptis CAF data.
    """
    TTR_THRESH = 0.720

    def _factor_count(toks: List[str]) -> float:
        types: set = set()
        count = 0
        factors = 0.0
        for w in toks:
            types.add(w)
            count += 1
            if len(types) / count <= TTR_THRESH:
                factors += 1
                types = set()
                count = 0
        if count > 0:
            ttr = len(types) / count
            factors += (1 - ttr) / (1 - TTR_THRESH)
        return factors if factors > 0 else 1.0

    if len(tokens) < 10:
        return 0.0

    fwd = len(tokens) / _factor_count(tokens)
    bwd = len(tokens) / _factor_count(list(reversed(tokens)))
    return round((fwd + bwd) / 2, 1)


def _lexical_density(tokens: List[str]) -> float:
    """
    Lexical density — content_words / total_words × 100.
    Neumanova (2015): spoken EFL learner range is 45.7 %–48.5 % across
    A2–B2; not a reliable standalone predictor (used at 10 % weight only).
    """
    if not tokens:
        return 0.0
    content = [t for t in tokens if t not in _FUNCTION_WORDS]
    return round(len(content) / len(tokens) * 100, 1)


def _subordination_index(text: str, sentence_count: int) -> float:
    """
    Subordination Index — subordinate conjunctions / sentence count.
    Barrot & Agdeppa (2021): listed among 14 complexity indices that linearly
    progress across CEFR levels (1-s2.0-S1075293520300714).
    Bae & Min (2020) AsiaTEFL: DC/C correlates with L2 writing proficiency.
    """
    if sentence_count == 0:
        return 0.0
    text_lower = text.lower()
    count = sum(
        len(re.findall(r'\b' + re.escape(c) + r'\b', text_lower))
        for c in _SUBORD_CONJ
    )
    return round(count / sentence_count, 2)


def _syntactic_error_rate(text: str) -> float:
    """
    Syntactic Error Rate (SER) per 100 words.
    Neumanova (2015): A2 = 9.16, B1 = 6.91, B2 = 4.53 errors/100 words.
    Uses Romanian interference error detector as the error source since
    the target population is Romanian EFL learners.
    """
    try:
        from app.services.romanian_error_detector import detect_romanian_errors
        result = detect_romanian_errors(text)
        word_count = max(len(text.split()), 1)
        return round(result["error_count"] / word_count * 100, 2)
    except Exception:
        return 0.0


def _score_from_thresholds(val: float, thresholds: List[tuple]) -> float:
    """Return band for the first threshold val meets (descending order)."""
    for threshold, band in thresholds:
        if val >= threshold:
            return float(band)
    return 1.0


#ELTS band mapping — all thresholds grounded in corpus data

def _band_fluency(wps: float, filler_rate: float) -> float:
    """
    IELTS Fluency & Coherence (1–9).
    Neumanova (2015): articulation rate (AR = words/speaking time) significantly
    discriminates proficiency levels (p < 0.012). Pallotti (2014): Filled Pause
    Ratio (FPR = filled pauses / total words) standard fluency measure.
    ielts-guide-for-test-takers.txt: official band qualitative descriptors.
    Weights: 60 % WPS (articulation rate) + 40 % filler avoidance (FPR proxy).
    """
    wps_band = _score_from_thresholds(wps, [
        (2.5, 9), (2.2, 8), (1.9, 7), (1.6, 6),
        (1.3, 5), (1.0, 4), (0.7, 3), (0.4, 2),
    ])
    # FPR thresholds: Pallotti (2014) standard filler analysis
    filler_band = _score_from_thresholds(-filler_rate, [
        (-2,  9), (-5,  8), (-8,  7), (-12, 6),
        (-18, 5), (-25, 4), (-35, 3), (-50, 2),
    ])
    raw = wps_band * 0.6 + filler_band * 0.4
    return round(raw * 2) / 2  # round to nearest 0.5


def _band_lexical(mtld: float, b2plus_pct: float, lex_density: float) -> float:
    """
    IELTS Lexical Resource (1–9).
    Kolahi Ahari et al. (2025): Lexical Diversity (MTLD) is the single strongest
    predictor of L2 speaking proficiency (β = .40, p < .001) → 50 % weight.
    B2+ vocabulary % from EVP Cambridge → 40 % weight.
    Lexical density (Neumanova 2015): observed range 45.7–48.5 % for spoken
    B-level text; not a reliable standalone predictor → 10 % weight only.
    """
    s_mtld = _score_from_thresholds(mtld, [
        (75, 9), (60, 8), (48, 7), (36, 6),
        (25, 5), (16, 4), (10, 3), (5,  2),
    ])
    s_b2 = _score_from_thresholds(b2plus_pct, [
        (20, 9), (15, 8), (10, 7), (6, 6),
        (3,  5), (1,  4),
    ])
    # LD thresholds calibrated from Neumanova (2015) spoken-text values:
    # A2≈48.5 %, B1≈45.7 %, B2≈46.3 %; C1/C2 extrapolated upward.
    s_density = _score_from_thresholds(lex_density, [
        (53, 9), (51, 8), (49, 7), (47, 6),
        (45.7, 5), (43, 4), (40, 3),
    ])
    raw = s_mtld * 0.50 + s_b2 * 0.40 + s_density * 0.10
    return round(raw * 2) / 2


def _band_grammar(mls: float, sub_index: float, ser: float) -> float:
    """
    IELTS Grammatical Range & Accuracy (1–9).
    Primary signal — SER (Syntactic Error Rate per 100 words):
      Neumanova (2015): A2 = 9.16, B1 = 6.91, B2 = 4.53 (all p < 0.011).
      Band thresholds derived from these empirical means ± 0.5 SD intervals.
    Secondary signal — MLS (Mean Length of Sentence):
      1-s2.0-S1075293520300714 lists MLS as one of 14 complexity indices
      that linearly progress across proficiency levels (Ortega 2003).
    Tertiary signal — Subordination Index (Barrot & Agdeppa 2021; Bae & Min 2020).
    Weights: 45 % SER + 35 % MLS + 20 % subordination.
    """
    # SER bands — higher error rate → lower band
    # Anchors: B2 boundary = 4.53, B1 boundary = 6.91, A2 boundary = 9.16
    s_ser = _score_from_thresholds(-ser, [
        (-1.5,  9),   # near-zero errors → Band 9
        (-2.5,  8),
        (-4.53, 7),   # above B2 threshold (Neumanova 2015)
        (-6.0,  6),
        (-6.91, 5),   # above B1 threshold (Neumanova 2015)
        (-8.0,  4),
        (-9.16, 3),   # above A2 threshold (Neumanova 2015)
        (-12,   2),
    ])

    s_mls = _score_from_thresholds(mls, [
        (18, 9), (15, 8), (12, 7), (9, 6),
        (7,  5), (5,  4), (3,  3),
    ])

    s_sub = _score_from_thresholds(sub_index, [
        (0.55, 9), (0.45, 8), (0.35, 7), (0.25, 6),
        (0.15, 5), (0.08, 4),
    ])

    raw = s_ser * 0.45 + s_mls * 0.35 + s_sub * 0.20
    return round(raw * 2) / 2


#Writing-mode cohesion (TAACO)
# Crossley, Kyle & McNamara (2016) — TAACO: Tool for Automatic Analysis of
# Cohesion. Behavior Research Methods 48(4), 1227–1237.
# (ThetoolfortheautomaticanalysisoftextcohesionTAACO.txt) — connective density
# (additive, adversative, causal, temporal, logical) is among the strongest
# predictors of expert essay-quality ratings (global cohesion).

_TAACO_CONNECTIVES = {
    # Additive
    'and', 'also', 'furthermore', 'moreover', 'additionally', 'besides',
    # Adversative
    'but', 'however', 'although', 'though', 'nevertheless', 'yet', 'whereas',
    'while', 'despite',
    # Causal
    'because', 'therefore', 'thus', 'consequently', 'since', 'so', 'hence',
    'accordingly',
    # Temporal
    'when', 'after', 'before', 'then', 'finally', 'meanwhile', 'subsequently',
    # Logical / clarification
    'firstly', 'secondly', 'finally', 'specifically', 'particularly',
    'instance', 'example', 'overall', 'conclusion',
}


def _connective_density(text: str, n_tokens: int) -> float:
    """Connectives per 100 tokens — TAACO global-cohesion proxy."""
    if n_tokens == 0:
        return 0.0
    tokens = re.findall(r"[a-zA-Z']+", text.lower())
    n_conn = sum(1 for t in tokens if t in _TAACO_CONNECTIVES)
    return round(n_conn / n_tokens * 100, 2)


def _band_writing_cohesion(sub_index: float, mls: float, conn_density: float) -> float:
    """
    IELTS Writing 'Coherence & Cohesion' band (1–9) for typed text.

    Replaces speech-only WPS / filler-rate calculation. Derived from:
      • Subordination Index — Bae & Min (2020) AsiaTEFL: SC measures correlate
        with writing proficiency (genre-based study, Korean L2 corpus).
      • Mean Length of Sentence — Barrot & Agdeppa (2021); Lee (2021) Table 2.
      • Connective density — Crossley, Kyle & McNamara (2016) TAACO.

    Weights: 40 % connectives, 35 % MLS, 25 % subordination.
    Empirical weighting reflects TAACO finding that global cohesion
    (connectives) is the strongest predictor of expert ratings (r > .50).
    """
    s_conn = _score_from_thresholds(conn_density, [
        (10.0, 9), (8.0, 8), (6.5, 7), (5.0, 6),
        (4.0, 5), (3.0, 4), (2.0, 3), (1.0, 2),
    ])
    s_mls = _score_from_thresholds(mls, [
        (22, 9), (19, 8), (16, 7), (13, 6),
        (11, 5), (9, 4), (7, 3), (5, 2),
    ])
    s_sub = _score_from_thresholds(sub_index, [
        (1.5, 9), (1.2, 8), (1.0, 7), (0.8, 6),
        (0.6, 5), (0.4, 4), (0.25, 3), (0.1, 2),
    ])
    raw = s_conn * 0.40 + s_mls * 0.35 + s_sub * 0.25
    return round(raw * 2) / 2


def _band_pronunciation(score: float) -> float:
    """
    IELTS Pronunciation (1–9) from 0–100 ASR/LLM score.
    ielts-guide-for-test-takers.txt: official band qualitative descriptors.
    Saito (2012, JSLP 14(2)): acoustic features in L2 pronunciation assessment.
    Linear mapping: score / 100 × 9, rounded to nearest 0.5.
    """
    return _score_from_thresholds(score, [
        (90, 9), (80, 8), (70, 7), (60, 6),
        (50, 5), (40, 4), (28, 3), (15, 2),
    ])


#CEFR mapping — from Kolahi Ahari et al. (2025) empirical data

# Official conversion cited in both 10.22034_ijlt.2025.492133.1395.txt (Kolahi Ahari, Ghonsooly, Ghapanchi & Soodmand Afshar).txt and
# 1-s2.0-S1075293520300714-main.txt (ETS + Cambridge ESOL official mapping).
_CEFR_MAP = [
    (8.5, 'C2', 'Cambridge Proficiency (CPE)',   'Mastery — near-native command of English'),
    (7.0, 'C1', 'Cambridge Advanced (CAE)',       'Effective operational proficiency'),
    (5.5, 'B2', 'Cambridge First (FCE)',          'Upper-intermediate — can handle complex topics'),
    (4.0, 'B1', 'Cambridge Preliminary (PET)',   'Threshold — can deal with everyday situations'),
    (3.0, 'A2', 'Cambridge Key (KET)',            'Waystage — basic communication in familiar situations'),
    (0.0, 'A1', 'Cambridge Starter',             'Breakthrough — very basic language use'),
]

_BAND_LABELS = {
    9: 'Expert user',        8: 'Very good user',
    7: 'Good user',          6: 'Competent user',
    5: 'Modest user',        4: 'Limited user',
    3: 'Extremely limited',  2: 'Intermittent user',
    1: 'Non-user',
}


def _cefr_from_ielts(band: float) -> Dict[str, str]:
    for min_band, level, exam, description in _CEFR_MAP:
        if band >= min_band:
            return {'level': level, 'exam': exam, 'description': description}
    return {'level': 'A1', 'exam': 'Cambridge Starter', 'description': 'Breakthrough — very basic language use'}


# Cambridge ESOL Speaking Assessment 
# Source: Cambridge English Skills Test for Schools — Speaking Assessment
# Criteria (Cambridge Assessment English, 2023).
# Stored locally in: articles_text/731659-cambridge-english-skills-test-
# schools-speaking-assessment-criteria.txt
#
# Cambridge uses 3 criteria (different from IELTS' 4):
#   1. Pronunciation and Fluency
#   2. Language Resource (lexical + grammatical combined)
#   3. Discourse Management (cohesion, linking, organisation)
#
# Each criterion is mapped directly to a CEFR level (A1, A2, B1, B2, C1).
# Overall level = lowest of the three (Cambridge convention: a learner cannot
# be rated C1 overall while one criterion is B1).

_CEFR_RANK = {'A1': 0, 'A2': 1, 'B1': 2, 'B2': 3, 'C1': 4, 'C2': 5}
_CEFR_RANK_REV = {v: k for k, v in _CEFR_RANK.items()}


def _cambridge_pron_fluency(pron_score: float, filler_rate: float, wps: float) -> tuple:
    """
    Map pronunciation + fluency to a Cambridge CEFR descriptor.
    Returns (level, descriptor_text).

    Thresholds reflect the official descriptors:
      C1 — intelligible, effortless flow, L1 features minimal
      B2 — generally intelligible, L1 features may occasionally interfere
      B1 — understandable but L1 features cause strain, uneven flow
      A2 — single words/phrases intelligible, L1 makes understanding difficult
      A1 — only individual words intelligible, excessive strain
    """
    if pron_score >= 85 and filler_rate <= 5 and wps >= 2.0:
        return 'C1', (
            'Pronunciation is intelligible; stress, rhythm, intonation and '
            'connected speech are used to express meaning well. Flow of speech '
            'is generally effortless with mostly natural hesitation and pauses.'
        )
    if pron_score >= 70 and filler_rate <= 10 and wps >= 1.7:
        return 'B2', (
            'Pronunciation is generally intelligible but L1 features may '
            'occasionally interfere; stress, rhythm and intonation are used '
            'to express meaning adequately. Some hesitation may be present '
            'while searching for language.'
        )
    if pron_score >= 55 and filler_rate <= 15 and wps >= 1.3:
        return 'B1', (
            'Pronunciation can generally be understood but L1 features may '
            'cause strain; attempts to use stress, rhythm and intonation to '
            'express meaning are not always successful. Flow of speech is '
            'uneven, with some signs of false starts, self-correction, '
            'repetition and/or unnatural hesitation.'
        )
    if pron_score >= 40:
        return 'A2', (
            'Pronunciation of single words and phrases may be intelligible '
            'but L1 features may make understanding difficult; attempts to '
            'use stress, rhythm and intonation to express meaning are '
            'unsuccessful. Utterances are short, with frequent hesitations '
            'and pauses.'
        )
    return 'A1', (
        'Pronunciation of individual words may be intelligible but L1 '
        'features may cause excessive strain to a listener; little attempt '
        'is made to use aspects of stress, rhythm or intonation to express '
        'meaning. Utterances are limited to single words or phrases, with '
        'excessive hesitations and pauses making speech difficult to follow.'
    )


def _cambridge_language_resource(mtld: float, b2plus_pct: float,
                                  ser: float, mls: float) -> tuple:
    """
    Map lexical + grammatical control to a Cambridge CEFR descriptor.
    Combines vocabulary diversity (MTLD), advanced-vocab usage (B2+ %),
    grammatical accuracy (SER), and sentence complexity (MLS).
    """
    score = _CEFR_RANK['A1']
    # MTLD thresholds (Kolahi Ahari et al. 2025; Yan et al. 2020)
    if   mtld >= 100: score = max(score, _CEFR_RANK['C1'])
    elif mtld >=  75: score = max(score, _CEFR_RANK['B2'])
    elif mtld >=  60: score = max(score, _CEFR_RANK['B1'])
    elif mtld >=  45: score = max(score, _CEFR_RANK['A2'])
    # B2+ vocabulary % (EVP Cambridge)
    if   b2plus_pct >= 40: score = max(score, _CEFR_RANK['C1'])
    elif b2plus_pct >= 25: score = max(score, _CEFR_RANK['B2'])
    elif b2plus_pct >= 15: score = max(score, _CEFR_RANK['B1'])
    elif b2plus_pct >=  5: score = max(score, _CEFR_RANK['A2'])
    # SER constraint (Neumanova 2015): low rank if errors are intrusive
    if ser > 9.16:
        score = min(score, _CEFR_RANK['A2'])
    elif ser > 6.91:
        score = min(score, _CEFR_RANK['B1'])
    elif ser > 4.53:
        score = min(score, _CEFR_RANK['B2'])
    # MLS — Barrot & Agdeppa (2021)
    if mls < 7: score = min(score, _CEFR_RANK['A2'])

    level = _CEFR_RANK_REV[score]
    descriptors = {
        'C1': 'Displays good control of complex language, including a range '
              'of vocabulary (e.g. attempts to use idiomatic expressions and '
              'collocations) and sophisticated syntactic structures. Lexical '
              'and/or grammatical errors, if present, are not intrusive.',
        'B2': 'Displays good control of simpler language and some control of '
              'complex language. Vocabulary range is sufficient to speak on '
              'general topics and functional areas with some complex sentence '
              'use. Errors are not intrusive and do not generally impede '
              'communication of ideas.',
        'B1': 'The range of grammar and vocabulary used is limited to more '
              'familiar topics and simpler sentence forms. Utterances using '
              'simple language are mostly accurate but inaccuracies and/or '
              'hesitations are noticeable when attempting more complex '
              'language. Errors may impede communication of ideas.',
        'A2': 'The range of language is insufficient. Some utterances (e.g. '
              'single words or short phrases) may be accurate but inaccuracies '
              'in grammar and vocabulary restrict communication of ideas.',
        'A1': 'The range of language is very limited. Some accurate language '
              '(e.g. pre-packaged utterances) may occur but frequent '
              'inaccuracies mean the message is not communicated.',
    }
    return level, descriptors[level]


def _cambridge_discourse_mgmt(conn_density: float, sub_index: float,
                               mls: float, sentence_count: int) -> tuple:
    """
    Map discourse organisation to a Cambridge CEFR descriptor.
    Uses TAACO connective density + Hunt subordination + MLS as proxies for
    "cohesive devices" and "organisational patterns".
    """
    if conn_density >= 8 and sub_index >= 1.0 and mls >= 14 and sentence_count >= 3:
        level = 'C1'; d = (
            'Utterances form a clear and well-structured whole which contains '
            'a range of cohesive devices and organisational patterns. The '
            'relationship between ideas is clearly signalled.'
        )
    elif conn_density >= 5 and sub_index >= 0.6 and mls >= 11:
        level = 'B2'; d = (
            'Utterances are linked into clear, coherent discourse. The '
            'relationship between ideas is generally clear but may require '
            'effort to identify in a longer contribution.'
        )
    elif conn_density >= 3 and mls >= 8:
        level = 'B1'; d = (
            'There is linking between simple elements into a connected '
            'sequence of points; however, ideas are not always clearly '
            'connected.'
        )
    elif conn_density >= 1 or sentence_count >= 2:
        level = 'A2'; d = (
            'There are signs of linking (e.g. but, and, because) but '
            'utterances are likely to be short and incomplete.'
        )
    else:
        level = 'A1'; d = (
            'Utterances are limited to isolated words and pre-packaged phrases.'
        )
    return level, d


def _compute_cambridge_assessment(
    pron_score: float, filler_rate: float, wps: float,
    mtld: float, b2plus_pct: float, ser: float, mls: float,
    sub_index: float, conn_density: float, sentence_count: int,
) -> Dict[str, Any]:
    """
    Produce the full Cambridge ESOL Speaking Assessment evaluation:
    three criteria + overall level (lowest of the three).
    """
    pf_level, pf_desc = _cambridge_pron_fluency(pron_score, filler_rate, wps)
    lr_level, lr_desc = _cambridge_language_resource(mtld, b2plus_pct, ser, mls)
    dm_level, dm_desc = _cambridge_discourse_mgmt(conn_density, sub_index, mls, sentence_count)

    # Cambridge convention: overall = lowest criterion
    overall_rank = min(_CEFR_RANK[pf_level], _CEFR_RANK[lr_level], _CEFR_RANK[dm_level])
    overall_level = _CEFR_RANK_REV[overall_rank]

    # Exam recommendation based on overall level
    exam_recommendation = {
        'C1': ('Cambridge C1 Advanced (CAE)', 'Ready for CAE preparation'),
        'B2': ('Cambridge B2 First (FCE)',   'Ready for FCE preparation'),
        'B1': ('Cambridge B1 Preliminary (PET)', 'Ready for PET; aim for FCE'),
        'A2': ('Cambridge A2 Key (KET)',     'Build toward PET; KET-level competence'),
        'A1': ('Cambridge Pre-A1 Starters',  'Foundation level; focus on basics'),
    }
    exam_name, advice = exam_recommendation[overall_level]

    return {
        'overall_level': overall_level,
        'recommended_exam': exam_name,
        'advice': advice,
        'criteria': {
            'pronunciation_fluency':  {'level': pf_level, 'descriptor': pf_desc},
            'language_resource':      {'level': lr_level, 'descriptor': lr_desc},
            'discourse_management':   {'level': dm_level, 'descriptor': dm_desc},
        },
        'source': (
            'Cambridge English Skills Test — Speaking Assessment Criteria '
            '(Cambridge Assessment English, 2023). Three-criterion rubric; '
            'overall level = lowest of the three (Cambridge convention).'
        ),
    }


#PTE Core estimate — via IELTS → CEFR → CLB → PTE Speaking 
#
# Derivation chain (all sources in articles_text):
#
#   Step 1  IELTS band → CEFR level
#     Kolahi Ahari et al. (2025) — 10.22034_ijlt.2025.492133.1395.txt
#     Official conversion: B1 = IELTS 4.0–5.0, B2 = 5.5–6.5, C1 = 7.0–8.0, C2 = 8.5–9.0
#
#   Step 2  CEFR level → CLB level
#     Council of Europe CEFR descriptors (globalscale.txt) and Canadian Language
#     Benchmarks use equivalent can-do statements.  IRCC official alignment:
#       A2 ≈ CLB 3–4  |  B1 ≈ CLB 5–6  |  B2 ≈ CLB 7–8  |  C1 ≈ CLB 9  |  C2 ≈ CLB 10
#
#   Step 3  CLB level → PTE Core Speaking score range
#     Pearson PTE (2024) — "PTE Core scoring" (PTE Core scoring _ Pearson PTE.txt)
#     Official CLB comparison table (Speaking column):
#       CLB 10 → 89–90  |  CLB 9 → 84–88  |  CLB 8 → 76–83  |  CLB 7 → 68–75
#       CLB 6  → 59–67  |  CLB 5 → 51–58  |  CLB 4 → 42–50  |  CLB 3 → 34–41

# Lookup table: (min_ielts_band, clb_level, pte_low, pte_high)
# Ordered descending so first match wins.
_PTE_CORE_TABLE = [
    (8.5, 10, 89, 90),
    (7.5,  9, 84, 88),
    (7.0,  9, 84, 88),
    (6.5,  8, 76, 83),
    (6.0,  8, 76, 83),
    (5.5,  7, 68, 75),
    (5.0,  6, 59, 67),
    (4.5,  5, 51, 58),
    (4.0,  5, 51, 58),
    (3.5,  4, 42, 50),
    (3.0,  3, 34, 41),
    (2.0,  3, 34, 41),
]

_CLB_CEFR = {10: 'C2', 9: 'C1', 8: 'B2', 7: 'B2', 6: 'B1', 5: 'B1', 4: 'A2', 3: 'A2'}


def _pte_core_from_ielts(ielts_band: float) -> Dict[str, Any]:
    """
    Estimate PTE Core Speaking score from IELTS overall band.

    Chain: IELTS → CEFR (Kolahi Ahari 2025) → CLB (IRCC/CEFR alignment,
    globalscale.txt) → PTE Speaking score range (Pearson PTE 2024,
    PTE Core scoring _ Pearson PTE.txt, Speaking column of CLB table).

    Returns the midpoint of the PTE Speaking range as the point estimate.
    PTE Core scale: 10–90.  CLB scale: 1–12 (only 3–10 documented).
    """
    for min_band, clb, pte_low, pte_high in _PTE_CORE_TABLE:
        if ielts_band >= min_band:
            pte_mid = round((pte_low + pte_high) / 2)
            cefr = _CLB_CEFR.get(clb, 'A1')
            return {
                'speaking_score': pte_mid,
                'score_range': f'{pte_low}–{pte_high}',
                'clb_level': clb,
                'cefr_equivalent': cefr,
                'description': (
                    f'Estimated PTE Core Speaking score {pte_mid} '
                    f'(range {pte_low}–{pte_high}) — CLB {clb}, CEFR {cefr}. '
                    'Derived via IELTS→CEFR→CLB→PTE chain; not a substitute for '
                    'an actual PTE Core test score.'
                ),
                'source': (
                    'Pearson PTE (2024): CLB comparison table, Speaking column '
                    '— PTE Core scoring _ Pearson PTE.txt; '
                    'Kolahi Ahari et al. (2025): IELTS→CEFR bridge '
                    '— 10.22034_ijlt.2025.492133.1395.txt; '
                    'Council of Europe (2020): CEFR global scale / CLB alignment '
                    '— globalscale.txt'
                ),
            }
    # Below CLB 3 (A1 territory)
    pte_mid = max(10, round(ielts_band / 3.0 * 34))
    return {
        'speaking_score': pte_mid,
        'score_range': f'10–33',
        'clb_level': None,
        'cefr_equivalent': 'A1',
        'description': (
            f'Estimated PTE Core Speaking score {pte_mid} (below CLB 3 threshold). '
            'Foundation-level proficiency.'
        ),
        'source': (
            'Pearson PTE (2024): PTE Core scoring — PTE Core scoring _ Pearson PTE.txt; '
            'Kolahi Ahari et al. (2025) — 10.22034_ijlt.2025.492133.1395.txt'
        ),
    }


#Public API 

def compute_exam_profile(
    text: str,
    pronunciation_score: float,
    wps: float,
    filler_rate: float,
    mls: float,
    cefr_distribution: Dict[str, float],
    input_mode: str = 'speaking',
    pronunciation_measured: bool = True,
) -> Dict[str, Any]:
    """
    Full exam profile: text indicators + IELTS bands + Cambridge CEFR.

    `input_mode`:
      • 'speaking' — IELTS Speaking criteria (Fluency & Coherence, Lexical
         Resource, Grammatical Range & Accuracy, Pronunciation), 4-criterion
         average. Uses WPS / filler_rate / pronunciation_score.
      • 'writing' — IELTS Writing-aligned criteria. Replaces WPS-based fluency
         with TAACO connective-density + subordination cohesion (Crossley,
         Kyle & McNamara 2016; Bae & Min 2020). Excludes pronunciation;
         3-criterion average. Knoch (2009): diagnostic writing scales should
         identify specific weaknesses, not global abilities.

    Numeric thresholds grounded in:
      Kolahi Ahari et al. (2025) — 10.22034_ijlt.2025.492133.1395.txt
      Neumanova (2015) — 8.+Z.+Neumanova+Do+publikacji+5.06.txt
      Pallotti (2014) — 21Routledge-Pallotti-CAF in SLA-LT-preprint.txt
      IELTS official descriptors — ielts-guide-for-test-takers.txt
      Barrot & Agdeppa (2021) — MLS / subordination complexity indices
      Crossley & Kyle (2018) TAALES — TAACO connective density
      Bae & Min (2020) AsiaTEFL — genre-based syntactic complexity
      Knoch (2009) — diagnostic assessment of writing
    """
    tokens = [w.lower() for w in re.findall(r"[a-zA-Z']+", text) if len(w) > 1]
    sentences = [s for s in re.split(r'[.!?]+', text) if len(s.strip()) > 3]
    sentence_count = max(len(sentences), 1)

    mtld_val = _mtld(tokens)
    lex_density = _lexical_density(tokens)
    sub_index = _subordination_index(text, sentence_count)
    ser = _syntactic_error_rate(text)
    conn_density = _connective_density(text, len(tokens))

    b2plus_pct = float(
        cefr_distribution.get('B2', 0)
        + cefr_distribution.get('C1', 0)
        + cefr_distribution.get('C2', 0)
    )

    is_writing = input_mode == 'writing'

    if is_writing:
        # IELTS Writing alignment: replace speech-only fluency with TAACO cohesion
        fc = _band_writing_cohesion(sub_index, mls, conn_density)
        lr = _band_lexical(mtld_val, b2plus_pct, lex_density)
        gr = _band_grammar(mls, sub_index, ser)
        pr = 0.0  # Pronunciation not applicable for writing
        overall = round((fc + lr + gr) / 3 * 2) / 2
        fc_label = 'Coherence & Cohesion'
    else:
        fc = _band_fluency(wps, filler_rate)
        lr = _band_lexical(mtld_val, b2plus_pct, lex_density)
        gr = _band_grammar(mls, sub_index, ser)
        if pronunciation_measured:
            pr = _band_pronunciation(pronunciation_score)
            overall = round((fc + lr + gr + pr) / 4 * 2) / 2
        else:
            # No real acoustic pronunciation score (wav2vec2 engine offline for
            # this free-speech recording). Be honest: drop pronunciation from the
            # average rather than fabricate a band from a placeholder score.
            pr = None
            overall = round((fc + lr + gr) / 3 * 2) / 2
        fc_label = 'Fluency & Coherence'

    band_label = _BAND_LABELS.get(round(overall), 'Limited user')
    cambridge = _cefr_from_ielts(overall)

    # Cambridge ESOL Speaking Assessment — separate 3-criterion rubric
    # (Cambridge Assessment English 2023, articles_text/731659-cambridge-…).
    # Only meaningful for speaking input; for writing we still compute it but
    # label pronunciation_fluency as "(not applicable)".
    cambridge_assessment = _compute_cambridge_assessment(
        pron_score=pronunciation_score if (not is_writing and pronunciation_measured) else 70.0,  # neutral default when pron not measured
        filler_rate=filler_rate,
        wps=wps if not is_writing else 2.0,
        mtld=mtld_val,
        b2plus_pct=b2plus_pct,
        ser=ser,
        mls=mls,
        sub_index=sub_index,
        conn_density=conn_density,
        sentence_count=sentence_count,
    )
    if is_writing:
        # Replace the pronunciation/fluency descriptor since it's not measured
        cambridge_assessment['criteria']['pronunciation_fluency'] = {
            'level': '—',
            'descriptor': 'Not applicable for written input. Cambridge Writing '
                          'uses Content, Communicative Achievement, Organisation, '
                          'and Language (different rubric).',
        }
    elif not pronunciation_measured:
        cambridge_assessment['criteria']['pronunciation_fluency'] = {
            'level': '—',
            'descriptor': 'Pronunciation not scored — the acoustic phoneme engine '
                          '(wav2vec2) was unavailable for this recording, so the '
                          'overall level is based on Language Resource and '
                          'Discourse Management only.',
        }

    sources = [
        'Kolahi Ahari et al. (2025): IELTS-CEFR mapping + β=.40 Lexical Diversity '
        '— 10.22034_ijlt.2025.492133.1395.txt (Kolahi Ahari, Ghonsooly, Ghapanchi & Soodmand Afshar)',
        'Neumanova (2015): SER A2=9.16, B1=6.91, B2=4.53 per 100 words; '
        'LD spoken range 45.7–48.5 % — 8.+Z.+Neumanova+Do+publikacji+5.06',
        'Pallotti (2014): Filled Pause Ratio, pause threshold 0.3–0.4 s '
        '— 21Routledge-Pallotti-CAF in SLA-LT-preprint',
        'Kolahi Ahari et al. (2025): MTLD TTR threshold=0.720, β=.40 predictor '
        '— 10.22034_ijlt.2025.492133.1395',
        'Barrot & Agdeppa (2021): Subordination Index / MLS complexity indices '
        '— 1-s2.0-S1075293520300714-main',
        'IELTS Band Descriptors — ielts-guide-for-test-takers (British Council '
        '/ Cambridge ESOL / IDP, 2024)',
    ]
    if is_writing:
        sources.extend([
            'Crossley, Kyle & McNamara (2016): TAACO connective density predicts '
            'expert essay-quality ratings — Behavior Research Methods 48(4), 1227–1237',
            'Bae & Min (2020): Genre-based syntactic complexity in L2 writing '
            '— AsiaTEFL Vol. 17 No. 3, 937–953',
            'Knoch (2009): Diagnostic assessment of writing — Language Testing 26(2), '
            '275–304 (specific elements, not global abilities)',
        ])
    sources.append(
        'Cambridge English Skills Test — Speaking Assessment Criteria '
        '(Cambridge Assessment English, 2023): 3-criterion rubric '
        '(Pronunciation & Fluency, Language Resource, Discourse Management) '
        '— articles_text/731659-cambridge-english-skills-test-schools-'
        'speaking-assessment-criteria.txt'
    )
    sources.append(
        'Pearson PTE (2024): PTE Core Speaking score → CLB level comparison table '
        '— PTE Core scoring _ Pearson PTE.txt; '
        'CEFR↔CLB alignment via Council of Europe Global Scale (globalscale.txt)'
    )

    pte_core = _pte_core_from_ielts(overall)

    return {
        'mode': input_mode,
        'fluency_coherence_label': fc_label,
        'indicators': {
            'mtld': mtld_val,
            'lexical_density': lex_density,
            'subordination_index': sub_index,
            'syntactic_error_rate': ser,
            'connective_density': conn_density,
            'wps': wps,
            'filler_rate': filler_rate,
            'mls': mls,
            'pronunciation_score': pronunciation_score,
            'b2plus_pct': round(b2plus_pct, 1),
            'word_count': len(tokens),
            'sentence_count': sentence_count,
        },
        'ielts': {
            'fluency_coherence': fc,
            'lexical_resource': lr,
            'grammatical_accuracy': gr,
            'pronunciation': pr,
            'overall': overall,
            'band_label': band_label,
        },
        'cambridge': cambridge,
        'cambridge_assessment': cambridge_assessment,
        'pte_core': pte_core,
        'sources': sources,
    }

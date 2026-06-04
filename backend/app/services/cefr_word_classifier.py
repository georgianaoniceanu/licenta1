"""
CEFR Vocabulary Level Classifier
─────────────────────────────────────────────────────────────────────────────

Primary Source (loaded at runtime):
  English Vocabulary Profile / EVP Online (Cambridge) — 6,345 single-word
  entries classified A1–C2 based on learner corpus evidence collected by the
  English Profile project. For polysemous words the lowest (most accessible)
  CEFR sense is used, following EVP documentation.
  Source file: articles_text/English Profile - EVP Online.txt (scraped from
  englishprofile.org, accessed 28 Apr 2026). Stored as evp_words.json.

Supplementary sources (for words absent from EVP):
  NAWL — New Academic Word List (article 26): 963 academic word families
  at B2–C1 (corpus of 15M academic words).

  General Service List (A1–B1) — high-frequency English word families
  classified by corpus frequency bands.

  Davies AVL (article 47): Academic Vocabulary List from COCA, B2–C1.

  TAALES (Crossley & Kyle 2018) — article 3: morphological suffix heuristics
  as last-resort fallback when a word is absent from all lists.

Classification Strategy:
  1. EVP lookup (6,345 entries, corpus-verified)
  2. Supplementary AWL/NAWL/GSL lookup (~600 extra entries)
  3. Morphological heuristic fallback (word length + suffix → level)
─────────────────────────────────────────────────────────────────────────────
"""

import re
import json
import os
from typing import Dict, List

# ─────────────────────────────────────────────────────────────────────────────
# LOAD EVP WORD MAP (primary source)
# 6,345 entries extracted from EVP Online (Cambridge English Profile project).
# evp_words.json lives next to this file.
# ─────────────────────────────────────────────────────────────────────────────

_EVP_PATH = os.path.join(os.path.dirname(__file__), "evp_words.json")
try:
    with open(_EVP_PATH, encoding="utf-8") as _f:
        _EVP_MAP: Dict[str, str] = json.load(_f)
except FileNotFoundError:
    _EVP_MAP = {}

# ─────────────────────────────────────────────────────────────────────────────
# SUPPLEMENTARY WORD LISTS (AWL / NAWL / new-GSL)
# Used only for words absent from EVP — keeps EVP as authoritative source.
# Sources: EVP Online (Cambridge), AWL (Coxhead 2000), NAWL (article 26),
#          general frequency bands (A1–B1), AVL (Davies, article 47)
# ─────────────────────────────────────────────────────────────────────────────

CEFR_WORDS: Dict[str, List[str]] = {
    "A1": [
        # Function words & basics — new-GSL band 1        "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
        "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
        "a", "an", "the", "and", "but", "or", "so", "because", "if", "when", "then",
        "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "do", "does", "did", "will", "would", "can", "could", "may", "might",
        "shall", "should", "must", "not", "no", "yes", "ok", "okay",
        # Basic nouns
        "cat", "dog", "house", "car", "day", "man", "woman", "boy", "girl",
        "book", "school", "food", "water", "home", "family", "mother", "father",
        "sister", "brother", "friend", "name", "time", "year", "city", "country",
        "hand", "eye", "head", "face", "hair", "door", "window", "room", "table",
        "chair", "bed", "bag", "phone", "number", "money", "shop", "street",
        # Basic adjectives
        "big", "small", "good", "bad", "new", "old", "hot", "cold", "happy",
        "sad", "fast", "slow", "tall", "short", "long", "clean", "dirty",
        "easy", "hard", "free", "open", "close", "high", "low", "right", "wrong",
        # Basic verbs
        "go", "come", "see", "look", "take", "make", "get", "give", "put", "say",
        "tell", "ask", "know", "think", "want", "need", "like", "love", "eat",
        "drink", "sleep", "walk", "run", "sit", "stand", "read", "write", "play",
        "work", "help", "call", "talk", "speak", "listen", "watch", "live", "buy",
        # Numbers/time
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "first", "second", "third", "today", "tomorrow", "yesterday", "now", "here",
        "there", "very", "also", "too", "just", "only", "well", "back", "out",
        "up", "down", "in", "on", "at", "to", "from", "with", "about", "after",
        "before", "for", "of", "by", "as",
    ],
    "A2": [
        # new-GSL band 2 / EVP A2        "actually", "already", "always", "answer", "anything", "around",
        "arrive", "begin", "believe", "between", "body", "break", "bring",
        "build", "business", "change", "check", "child", "children", "choose",
        "colour", "color", "continue", "corner", "correct", "cost", "cover",
        "create", "cut", "decide", "describe", "different", "difficult",
        "drive", "either", "enjoy", "enough", "event", "example", "explain",
        "feel", "finish", "floor", "follow", "forget", "future", "great",
        "ground", "group", "happen", "hear", "hope", "idea", "important",
        "include", "instead", "interest", "job", "keep", "kind", "later",
        "leave", "meet", "mind", "miss", "moment", "move", "next", "offer",
        "often", "order", "other", "outside", "own", "past", "pay", "people",
        "place", "plan", "point", "problem", "question", "really", "remember",
        "return", "same", "send", "show", "side", "simple", "since", "situation",
        "sometimes", "soon", "sort", "spend", "start", "stay", "still", "stop",
        "study", "sure", "together", "travel", "try", "turn", "type", "use",
        "usually", "visit", "voice", "wait", "way", "whole", "world", "write",
        # British/American variants
        "centre", "center", "favourite", "favorite", "programme", "program",
        "realise", "realize", "organise", "organize", "recognise", "recognize",
    ],
    "B1": [
        # new-GSL bands 3–4 / EVP B1        "achieve", "advantage", "affect", "agreement", "although", "amount",
        "announce", "appear", "apply", "approach", "argue", "aspect", "assist",
        "assume", "attempt", "attention", "attitude", "authority", "available",
        "aware", "benefit", "career", "cause", "challenge", "choice", "claim",
        "clear", "collect", "compare", "complete", "complex", "concern",
        "condition", "consider", "contact", "contain", "control", "current",
        "danger", "decision", "demand", "depend", "detail", "develop", "discover",
        "discuss", "due", "economy", "education", "effect", "effort", "election",
        "environment", "especially", "establish", "evidence", "expect", "experience",
        "express", "fail", "focus", "force", "form", "general", "global", "grow",
        "happen", "health", "however", "image", "improve", "include", "increase",
        "individual", "influence", "information", "introduce", "involve", "issue",
        "knowledge", "language", "leader", "level", "local", "main", "major",
        "manage", "matter", "media", "method", "model", "modern", "natural",
        "necessary", "notice", "opportunity", "option", "participate", "particular",
        "perhaps", "period", "policy", "position", "positive", "possible",
        "practice", "prepare", "present", "prevent", "process", "produce",
        "project", "protect", "provide", "purpose", "raise", "reason", "receive",
        "recent", "reduce", "region", "relate", "remain", "report", "require",
        "research", "respond", "result", "role", "rule", "save", "serious",
        "several", "share", "social", "society", "source", "specific", "statement",
        "subject", "suggest", "support", "system", "therefore", "though",
        "throughout", "tradition", "therefore", "understand", "unless", "various",
        "whether", "while",
        # British/American
        "behaviour", "behavior", "neighbour", "neighbor", "labour", "labor",
        "honour", "honor", "analyse", "analyze",
    ],
    "B2": [
        # AWL sublist 1–4 (Coxhead 2000) + new-GSL band 5–6
        "abstract", "accurate", "acquire", "adequate", "analyse", "analyze",
        "appropriate", "assessment", "assumption", "category", "circumstances",
        "coherent", "communicate", "component", "comprise", "concept",
        "consequently", "consist", "construct", "context", "controversy",
        "conventional", "crucial", "culture", "debate", "define", "demonstrate",
        "derive", "dimension", "distinction", "diverse", "dominant", "duration",
        "emerge", "emphasis", "enhance", "ensure", "evaluate", "evolution",
        "explicit", "extent", "factor", "feature", "foundation", "framework",
        "fundamental", "furthermore", "generate", "hypothesis", "identify",
        "illustrate", "impact", "implement", "implication", "indicate",
        "interpret", "investigate", "justify", "maintain", "mechanism",
        "moreover", "nevertheless", "nonetheless", "obtain", "occur",
        "outcome", "perspective", "phenomenon", "principle", "proceed",
        "proportion", "pursue", "reflect", "reinforce", "relevant", "resolve",
        "reveal", "scope", "sector", "significant", "strategy", "structure",
        "substantial", "sufficient", "supplement", "sustain", "theory",
        "thereby", "thus", "ultimately", "underlying", "whereas",
        # NAWL (article 26) — academic register
        "accumulate", "acknowledge", "adjacent", "administer", "allocate",
        "ambiguous", "anticipate", "arbitrary", "articulate", "attribute",
        "autonomous", "bias", "capacity", "circumstance", "comprehensive",
        "constitute", "contradiction", "criterion", "cumulative", "depict",
        "detect", "deviate", "dynamic", "equivalent", "explicit", "facilitate",
        "fluctuate", "formulate", "hypothesis", "identical", "implicit",
        "inherent", "initiate", "integrate", "interact", "internal", "interval",
        "isolate", "manipulate", "margin", "mediate", "minimal", "monitor",
        "neutral", "nevertheless", "nonetheless", "objective", "overlap",
        "parameter", "perceive", "pragmatic", "preliminary", "protocol",
        "qualitative", "quantitative", "regulate", "reinforce", "sequence",
        "simulate", "systematic", "theoretical", "variable",
    ],
    "C1": [
        # AWL sublist 5–10 + EVP C1 + NAWL higher bands
        "albeit", "alleviate", "ambivalent", "analogous", "anomaly",
        "anticipate", "apparatus", "articulate", "ascertain", "assertion",
        "axiom", "benchmark", "capacity", "catalyst", "caveat", "coherence",
        "cohesion", "commensurate", "compel", "concede", "concur", "conjecture",
        "contemplate", "converge", "corroborate", "criteria", "delineate",
        "dichotomy", "discourse", "disparity", "disposition", "diverge",
        "elucidate", "empirical", "enumerate", "epistemological", "equivocal",
        "exemplify", "exhaustive", "expedite", "explicit", "extrapolate",
        "feasible", "forge", "formidable", "forthcoming", "foster", "gauge",
        "glean", "holistic", "illuminate", "imminent", "imperceptible",
        "incline", "inconclusive", "indeterminate", "inevitable", "inference",
        "inherent", "innovative", "instantiate", "intrinsic", "invariably",
        "leverage", "manifest", "meticulous", "mitigate", "nuanced",
        "obscure", "paradigm", "paradox", "pertinent", "polarise", "polarize",
        "pragmatic", "precedent", "preliminary", "prevalent", "profound",
        "proliferate", "rationale", "reconcile", "refute", "rigorous",
        "robust", "scrutinize", "scrutinise", "seminal", "sophisticated",
        "speculate", "stipulate", "subjective", "substantiate", "supersede",
        "synthesize", "synthesise", "tentative", "threshold", "trajectory",
        "ubiquitous", "unambiguous", "validate", "viable",
    ],
    "C2": [
        # EVP C2 — rare, nuanced, highly academic vocabulary
        "abstruse", "acrimony", "adumbrate", "ameliorate", "anachronism",
        "antithetical", "apocryphal", "assiduous", "attrition", "bellicose",
        "byzantine", "capricious", "circuitous", "cogent", "complaisant",
        "compunction", "contrite", "convolution", "disingenuous", "dissimulate",
        "ebullient", "effusive", "egregious", "enervate", "ephemeral",
        "equanimity", "equivocate", "erudite", "esoteric", "exacerbate",
        "exculpate", "exemplary", "exigent", "extemporaneous", "facetious",
        "fallacious", "fastidious", "fortuitous", "garrulous", "idiosyncratic",
        "impecunious", "impetuous", "impugn", "inadvertent", "inchoate",
        "inimical", "insidious", "intransigent", "irrefutable", "laconic",
        "loquacious", "malapropism", "mendacious", "meticulous", "moot",
        "nascent", "nefarious", "nomenclature", "obfuscate", "obsequious",
        "obstreperous", "onerous", "opaque", "ostensible", "pejorative",
        "perfidious", "perspicacious", "pertinacious", "plausible", "polemical",
        "precipitate", "precocious", "preemptive", "prescient", "propitious",
        "punctilious", "querulous", "recalcitrant", "redolent", "repudiate",
        "reticent", "sagacious", "sanguine", "salient", "sardonic", "solipsism",
        "spurious", "stoic", "stymie", "surreptitious", "taciturn", "tenuous",
        "terse", "torpid", "truculent", "unequivocal", "vacillate", "verbose",
        "vicarious", "voluminous", "wary", "zealous",
    ],
}

# Build lookup dict: word → level
# Priority: EVP (authoritative) → supplementary AWL/NAWL/GSL lists
_WORD_LEVEL_MAP: Dict[str, str] = {}

# 1. Load supplementary lists first (lower priority)
for _level, _words in CEFR_WORDS.items():
    for _w in _words:
        _WORD_LEVEL_MAP[_w.lower()] = _level

# 2. Overwrite with EVP data (6,345 corpus-verified entries — highest priority)
_WORD_LEVEL_MAP.update(_EVP_MAP)

_TOTAL_LOOKUP = len(_WORD_LEVEL_MAP)  # ~6,800 entries after merge

# ─────────────────────────────────────────────────────────────────────────────
# BRITISH ENGLISH ALIASES
# EVP file is American English (dict=us). Romanian learners often write
# British spellings (school curriculum). Map each British form to the same
# CEFR level as its American counterpart.
# ─────────────────────────────────────────────────────────────────────────────

_BRITISH_TO_AMERICAN = {
    # -our / -or
    "colour": "color", "favour": "favor", "flavour": "flavor",
    "honour": "honor", "humour": "humor", "labour": "labor",
    "neighbour": "neighbor", "rumour": "rumor", "savour": "savor",
    "tumour": "tumor", "valour": "valor", "vigour": "vigor",
    "behaviour": "behavior", "endeavour": "endeavor", "harbour": "harbor",
    # -re / -er
    "centre": "center", "litre": "liter", "metre": "meter",
    "theatre": "theater", "fibre": "fiber", "spectre": "specter",
    "calibre": "caliber", "lustre": "luster",
    # -ise / -ize
    "organise": "organize", "recognise": "recognize", "realise": "realize",
    "analyse": "analyze", "apologise": "apologize", "authorise": "authorize",
    "characterise": "characterize", "emphasise": "emphasize",
    "familiarise": "familiarize", "finalise": "finalize",
    "generalise": "generalize", "globalise": "globalize",
    "harmonise": "harmonize", "idealise": "idealize",
    "legalise": "legalize", "maximise": "maximize",
    "minimise": "minimize", "modernise": "modernize",
    "normalise": "normalize", "optimise": "optimize",
    "personalise": "personalize", "prioritise": "prioritize",
    "privatise": "privatize", "realise": "realize",
    "specialise": "specialize", "standardise": "standardize",
    "symbolise": "symbolize", "utilise": "utilize",
    "criticise": "criticize", "advertise": "advertise",
    "polarise": "polarize", "synthesise": "synthesize",
    "scrutinise": "scrutinize",
    # -ogue / -og
    "catalogue": "catalog", "dialogue": "dialog", "monologue": "monolog",
    "analogue": "analog",
    # -ence / -ense
    "defence": "defense", "licence": "license", "offence": "offense",
    "pretence": "pretense",
    # -ll / -l
    "fulfil": "fulfill", "skilful": "skillful", "wilful": "willful",
    "enrol": "enroll", "instil": "instill",
    # -gramme / -gram
    "programme": "program",
    # miscellaneous
    "favourite": "favorite", "practise": "practice", "ageing": "aging",
    "aeroplane": "airplane", "cheque": "check", "cosy": "cozy",
    "draught": "draft", "grey": "gray", "jewellery": "jewelry",
    "marvellous": "marvelous", "pyjamas": "pajamas", "sceptic": "skeptic",
    "storey": "story", "tyre": "tire", "travelled": "traveled",
    "modelling": "modeling", "labelling": "labeling",
}

for _br, _am in _BRITISH_TO_AMERICAN.items():
    if _am in _WORD_LEVEL_MAP:
        _WORD_LEVEL_MAP[_br] = _WORD_LEVEL_MAP[_am]

# Level ordering for comparison
_LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
_LEVEL_RANK = {lvl: i for i, lvl in enumerate(_LEVEL_ORDER)}


# ─────────────────────────────────────────────────────────────────────────────
# LEMMATIZER (rule-based + irregular-verb table)
#
# EVP Online stores only base forms (`come`, `go`, `eat`, …). Without lemmatising
# the input, every inflected form (`coming`, `goes`, `came`, `going`, `eating`)
# falls through to the morphological heuristic, which over-classifies them as
# B1/B2. This routine maps a surface form back to its lemma so we can hit the
# EVP entry for the same word.
#
# Approach: try the surface form first; if missing, generate candidate lemmas
# via common English inflection rules, then try the irregular table.
# ─────────────────────────────────────────────────────────────────────────────

# Common irregular verb forms (past, past participle, -ing) → base form
_IRREGULAR_VERBS: Dict[str, str] = {
    "came": "come", "gone": "go", "went": "go", "did": "do", "done": "do",
    "ate": "eat", "eaten": "eat", "saw": "see", "seen": "see",
    "took": "take", "taken": "take", "made": "make", "had": "have",
    "got": "get", "gotten": "get", "gave": "give", "given": "give",
    "knew": "know", "known": "know", "thought": "think", "told": "tell",
    "said": "say", "found": "find", "felt": "feel", "kept": "keep",
    "left": "leave", "met": "meet", "paid": "pay", "put": "put",
    "ran": "run", "read": "read", "ran": "run", "sat": "sit", "stood": "stand",
    "spoke": "speak", "spoken": "speak", "spent": "spend", "swam": "swim",
    "swum": "swim", "taught": "teach", "torn": "tear", "tore": "tear",
    "told": "tell", "thought": "think", "threw": "throw", "thrown": "throw",
    "understood": "understand", "won": "win", "wore": "wear", "worn": "wear",
    "wrote": "write", "written": "write", "broke": "break", "broken": "break",
    "brought": "bring", "bought": "buy", "built": "build", "burnt": "burn",
    "caught": "catch", "chose": "choose", "chosen": "choose",
    "drew": "draw", "drawn": "draw", "drove": "drive", "driven": "drive",
    "drank": "drink", "drunk": "drink", "fell": "fall", "fallen": "fall",
    "flew": "fly", "flown": "fly", "forgot": "forget", "forgotten": "forget",
    "froze": "freeze", "frozen": "freeze", "grew": "grow", "grown": "grow",
    "heard": "hear", "held": "hold", "hung": "hang", "hurt": "hurt",
    "led": "lead", "lent": "lend", "lost": "lose", "meant": "mean",
    "rode": "ride", "ridden": "ride", "rose": "rise", "risen": "rise",
    "sang": "sing", "sung": "sing", "sank": "sink", "sunk": "sink",
    "slept": "sleep", "spread": "spread", "stuck": "stick",
    # Common irregular plurals
    "men": "man", "women": "woman", "children": "child", "people": "person",
    "feet": "foot", "teeth": "tooth", "mice": "mouse", "geese": "goose",
    # Pronouns / possessives → already in EVP, but cover oblique forms
    "us": "we", "him": "he", "them": "they", "her": "she",
    "my": "i", "your": "you", "his": "he", "their": "they", "our": "we",
}


def _candidate_lemmas(word: str) -> list:
    """Return ordered list of candidate base forms to look up after the surface form."""
    w = word.lower()
    cands = []

    # 1. Irregular verbs / pronouns / plurals
    if w in _IRREGULAR_VERBS:
        cands.append(_IRREGULAR_VERBS[w])

    # 2. Plural / 3rd-person -s, -es, -ies
    if len(w) > 3:
        if w.endswith("ies"):
            cands.append(w[:-3] + "y")        # studies → study
        if w.endswith("es"):
            cands.append(w[:-2])               # boxes → box, goes → go (also kisses → kiss)
        if w.endswith("s"):
            cands.append(w[:-1])               # comes → come, cats → cat

    # 3. Past tense / past participle -ed, -d, -ied
    if len(w) > 3:
        if w.endswith("ied"):
            cands.append(w[:-3] + "y")        # studied → study
        if w.endswith("ed"):
            cands.append(w[:-2])               # walked → walk
            cands.append(w[:-1])               # liked → like
            # double consonant: stopped → stop
            if len(w) > 4 and w[-3] == w[-4]:
                cands.append(w[:-3])

    # 4. Present participle / gerund -ing
    if len(w) > 4 and w.endswith("ing"):
        cands.append(w[:-3])                   # going → go
        cands.append(w[:-3] + "e")             # coming → come, making → make
        # double consonant: running → run
        if len(w) > 5 and w[-4] == w[-5]:
            cands.append(w[:-4])
        # -ying → -y: studying → study (drop ing without restore — already tried)
        cands.append(w[:-3] + "y")

    # 5. Comparative / superlative -er, -est
    if len(w) > 4 and w.endswith("er"):
        cands.append(w[:-2])                   # bigger → bigg → big (handled below)
        cands.append(w[:-1])                   # nicer → nice
    if len(w) > 5 and w.endswith("est"):
        cands.append(w[:-3])
        cands.append(w[:-2])

    # 6. Adverb -ly  (quickly → quick)
    if len(w) > 4 and w.endswith("ly"):
        cands.append(w[:-2])

    # Deduplicate keeping order, drop empty / too-short
    seen = set()
    out = []
    for c in cands:
        if c and len(c) >= 2 and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _lookup_level(word: str) -> tuple:
    """
    Return (level, source) where source is 'direct', 'lemma', or 'heuristic'.
    Checks both the surface form and candidate lemmas, taking the lower level.
    This prevents inflected forms of basic words (e.g. "saying" → say/A1) from
    being over-classified by a higher-level EVP entry for a different sense
    (e.g. EVP "saying" = C2 noun/proverb).
    """
    w = word.lower()
    direct_level = _WORD_LEVEL_MAP.get(w)

    lemma_level = None
    for cand in _candidate_lemmas(w):
        if cand in _WORD_LEVEL_MAP:
            lemma_level = _WORD_LEVEL_MAP[cand]
            break

    if direct_level and lemma_level:
        # Prefer the lower level — inflected verb forms should not be penalised
        # by a high-level EVP entry for a different (nominal/adjectival) sense
        if _LEVEL_RANK[lemma_level] < _LEVEL_RANK[direct_level]:
            return lemma_level, "lemma"
        return direct_level, "direct"
    if direct_level:
        return direct_level, "direct"
    if lemma_level:
        return lemma_level, "lemma"
    return _heuristic_level(w), "heuristic"


# ─────────────────────────────────────────────────────────────────────────────
# HEURISTIC FALLBACK (for words not in the lookup table)
# Based on: word length, morphological suffixes, frequency estimation
# Sources: TAALES (Crossley & Kyle 2018), NAWL (article 26)
# ─────────────────────────────────────────────────────────────────────────────

# C1/C2 suffixes — typically formal/academic register (AWL, NAWL)
_C1_SUFFIXES = (
    "tion", "sion", "ment", "ance", "ence", "ity", "ism", "ist",
    "ize", "ise", "ify", "ous", "ive", "ary", "ory", "ic", "al",
    "ological", "istic", "ative",
)

def _heuristic_level(word: str) -> str:
    """
    Estimate CEFR level for unknown words using morphological heuristics.
    TAALES (Crossley & Kyle 2018): word length strongly correlates with
    lexical sophistication and CEFR level.
    """
    w = word.lower()
    n = len(w)
    if n <= 3:
        return "A1"
    if n <= 5:
        return "A2"
    if n <= 7:
        return "B1"
    # Check C1/C2 suffixes for longer words
    if n >= 10 and any(w.endswith(s) for s in _C1_SUFFIXES):
        return "C1" if n < 14 else "C2"
    if n >= 8 and any(w.endswith(s) for s in _C1_SUFFIXES):
        return "B2"
    if n >= 8:
        return "B2"
    return "B1"


# ─────────────────────────────────────────────────────────────────────────────
# MAIN CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────

def classify_vocabulary(text: str) -> Dict:
    """
    Classify each word in the text to a CEFR level and return distribution.

    Args:
        text: Learner's English text.

    Returns:
        {
            "distribution": {"A1": %, "A2": %, "B1": %, "B2": %, "C1": %, "C2": %},
            "total_words": int,
            "classified_words": int,        # found in lookup table
            "heuristic_words": int,         # estimated by heuristic
            "highest_level_words": [str],   # top-10 most advanced words
            "level_breakdown": {"A1": [w..], ...},
            "research": "..."
        }
    """
    # Tokenize — only alphabetic words, no stopwords for level counting
    tokens = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    if not tokens:
        return _empty_result()

    level_counts = {lvl: 0 for lvl in _LEVEL_ORDER}
    level_words: Dict[str, List[str]] = {lvl: [] for lvl in _LEVEL_ORDER}
    classified = 0
    heuristic = 0

    for word in tokens:
        lvl, source = _lookup_level(word)
        if source == "heuristic":
            heuristic += 1
        else:
            classified += 1
        level_counts[lvl] += 1
        if word not in level_words[lvl]:
            level_words[lvl].append(word)

    total = len(tokens)
    distribution = {
        lvl: round(level_counts[lvl] / total * 100, 1)
        for lvl in _LEVEL_ORDER
    }

    # Most advanced words (C1 + C2 unique words, top 10)
    advanced = list(dict.fromkeys(level_words["C2"] + level_words["C1"]))[:10]

    # Vocabulary CEFR level: highest level reached by ≥5% of tokens
    vocab_level = "A1"
    for lvl in reversed(_LEVEL_ORDER):
        if distribution[lvl] >= 5.0:
            vocab_level = lvl
            break

    return {
        "distribution": distribution,
        "vocab_cefr_level": vocab_level,
        "total_words": total,
        "classified_words": classified,
        "heuristic_words": heuristic,
        "highest_level_words": advanced,
        "level_breakdown": {
            lvl: level_words[lvl][:15]  # max 15 examples per level
            for lvl in _LEVEL_ORDER
        },
        "research": (
            f"Primary: English Vocabulary Profile / EVP Online (Cambridge) — "
            f"{len(_EVP_MAP)} corpus-verified A1–C2 entries (englishprofile.org). "
            "Supplementary: NAWL (article 26) B2–C1 academic register; "
            "General Service List A1–B1 frequency bands; "
            "AVL (Davies, article 47) B2–C1 academic vocabulary. "
            "Fallback: TAALES morphological heuristics (Crossley & Kyle 2018)."
        ),
    }


def _empty_result() -> Dict:
    return {
        "distribution": {lvl: 0.0 for lvl in _LEVEL_ORDER},
        "vocab_cefr_level": "A1",
        "total_words": 0,
        "classified_words": 0,
        "heuristic_words": 0,
        "highest_level_words": [],
        "level_breakdown": {lvl: [] for lvl in _LEVEL_ORDER},
        "research": "Insufficient text for vocabulary classification.",
    }


def tag_words_in_order(text: str) -> List[Dict]:
    """
    Return each alphabetic token in order with its CEFR level.
    Used for per-word colour-coding in the frontend (Foster & Tavakoli 2009;
    English Vocabulary Profile / Cambridge EVP Online).

    Args:
        text: Any English text.

    Returns:
        [{"word": "original_token", "level": "B2"}, ...]
    """
    tokens = re.findall(r"[a-zA-Z]+", text)
    result = []
    for token in tokens:
        lvl, _src = _lookup_level(token)
        result.append({"word": token, "level": lvl})
    return result

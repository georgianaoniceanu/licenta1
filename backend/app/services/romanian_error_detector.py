"""
Romanian Interference Error Detector
─────────────────────────────────────────────────────────────────────────────

Research Foundation:
  Pungă & Pârlog (2015): Rule-based patterns for automatic detection of L1
  (Romanian) interference errors in English learner language.
  Published in Analele Universității din Craiova, Seria Științe Filologice,
  Lingvistică, vol. XXXVII (2015), pp. 161–176.
  Corpus-based analysis of article errors (pp. 163–164), preposition errors
  (pp. 165–166), and SVO word order violations in Romanian university
  students' writing.

  Popescu (2013): Concordance-based error analysis for Romanian learners
  at Business & Public Administration profile.

  Leahu (2010) / Romanian Grammar (GALR, 2008): Romanian uses negative
  concord ("nu știu nimic" lit. "I don't know nothing") as a grammatical
  requirement — unlike English, which prohibits double negation.

  Note: Măchiță (2021) covers phonological L1 transfer (vowel/consonant
  acquisition via Auditory Distance Model) and is cited in the Accent DNA
  module, not here.

Error Categories Implemented:
  1. Article errors  — omission/confusion (Romanian has no prepended article)
  2. Preposition errors — at/on/to/in confusion (direct L1 transfer)
  3. SVO word order — adverb misplacement (Romanian allows more flexibility)
  4. Double negation — Romanian obligatory negative concord (GALR 2008)
  5. False friends — common Romanian-English cognate errors
  6. Tense errors — Romanian lacks progressive aspect, often omits -ing form
  7. Collocational errors — Popescu (2013) ELTC empirical finding: 377 / 854
     errors (44 %) in 30 Romanian EFL students were collocational, the largest
     single error category. Sub-types: V+N (catch fire, put pressure),
     Adj+N (domestic market vs. *intern market), V+Prep (participate in,
     depend on, benefit from), prepositional phrases (on vacation, on the
     first of January).
─────────────────────────────────────────────────────────────────────────────
"""

import re
from typing import List, Dict, Any


# ─────────────────────────────────────────────────────────────────────────────
# RULE DEFINITIONS
# Each rule: pattern (regex), error_type, message, severity (1–3)
# ─────────────────────────────────────────────────────────────────────────────

# Category 1: Article errors — Pungă & Pârlog (2015) pp.163–164
# Romanians omit "the" before known referents and use "a" before vowels incorrectly
ARTICLE_RULES = [
    # "a" before vowel sound — should be "an"
    {
        "pattern": r"\ba\s+(a|e|i|o|u|hour|honour|honest|heir)\b",
        "error_type": "article_a_vs_an",
        "message": 'Use "an" before words starting with a vowel sound (e.g., "an apple", "an hour").',
        "severity": 1,
        "source": "Pungă & Pârlog (2015) Article Error Type A",
    },
    # Missing article before singular countable nouns (heuristic: adjective + noun without article)
    {
        "pattern": r"\b(is|was|are|were|become|became|seems?|appears?)\s+(very\s+)?(good|bad|big|small|important|beautiful|difficult|easy|interesting)\s+(person|student|teacher|place|city|country|problem|solution|idea|example)\b",
        "error_type": "article_omission",
        "message": 'Missing article before a singular countable noun (e.g., "a good student", "an important idea").',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) pp.163–164 — most frequent error category",
    },
    # "the" used with abstract nouns incorrectly (Romanian uses definite article broadly)
    {
        "pattern": r"\bthe\s+(life|love|freedom|justice|education|happiness|success|knowledge|nature|society)\s+is\b",
        "error_type": "article_with_abstract",
        "message": 'Avoid "the" with abstract nouns used in a general sense (e.g., "Life is beautiful", not "The life is beautiful").',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) Romanian definite article L1 transfer",
    },
]

# Category 2: Preposition errors — Pungă & Pârlog (2015) pp.165–166
PREPOSITION_RULES = [
    # "at" vs "in" for cities/countries (Romanian uses "la" = at, for both)
    {
        "pattern": r"\bat\s+(school|university|college|work|home|the\s+hospital|the\s+office|the\s+market|the\s+park)\b",
        "error_type": "preposition_at_in",
        "message": 'Use "in" for enclosed spaces: "in school", "in the hospital" (Romanian "la" maps to "at" and "in").',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) pp.165–166 preposition confusion",
    },
    # "to" vs "at" for locations (Romanian "la" covers both destinations and locations)
    {
        "pattern": r"\bgo\s+at\s+(the\s+)?(store|shop|cinema|gym|library|beach|park|restaurant|market)\b",
        "error_type": "preposition_go_at",
        "message": 'Use "go to": "go to the store", "go to the cinema" (not "go at").',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) motion verb + preposition errors",
    },
    # "in" vs "on" for surfaces/time (Romanian "pe" = on, "în" = in, often confused)
    {
        "pattern": r"\bin\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|the\s+weekend)\b",
        "error_type": "preposition_in_on_time",
        "message": 'Use "on" for days: "on Monday", "on the weekend" (Romanian "în" used for all time expressions).',
        "severity": 1,
        "source": "Pungă & Pârlog (2015) temporal preposition confusion",
    },
    # "since" vs "for" with duration
    {
        "pattern": r"\bsince\s+\d+\s+(years?|months?|weeks?|days?|hours?)\b",
        "error_type": "preposition_since_for",
        "message": 'Use "for" with duration: "for 3 years" (use "since" only with a point in time).',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) temporal connector errors",
    },
]

# Category 3: SVO word order — Pungă & Pârlog (2015) adverb misplacement
WORD_ORDER_RULES = [
    # Adverb between verb and object (Romanian allows: "Eu mănânc repede mâncarea")
    {
        "pattern": r"\b(eat|ate|eaten|drink|drank|read|write|wrote|see|saw|watch|watched|do|did|make|made|like|liked|love|loved|want|wanted|need|needed)\s+(always|usually|often|sometimes|never|rarely|quickly|slowly|carefully|well|badly)\s+(the|a|an|my|your|his|her|their|our)\b",
        "error_type": "word_order_adverb",
        "message": "Place adverbs before the main verb, not between verb and object (e.g., 'I always eat lunch', not 'I eat always lunch').",
        "severity": 2,
        "source": "Pungă & Pârlog (2015) SVO order violation",
    },
    # Frequency adverb after subject but before auxiliary (correct placement check)
    {
        "pattern": r"\b(i|he|she|we|they|you)\s+(the|a|an)\s+\w+\s+(always|usually|often|sometimes|never)\b",
        "error_type": "word_order_adverb_position",
        "message": "Frequency adverbs (always, usually, often) go before the main verb: 'I always eat' not 'I eat always'.",
        "severity": 2,
        "source": "Pungă & Pârlog (2015) adverb placement in Romanian learners",
    },
]

# Category 4: Double negation — Romanian obligatory negative concord
# Romanian grammar (GALR 2008, vol. I, p.653) requires both the negative
# particle "nu" AND a negative pronoun ("nimic", "nimeni", "nicăieri"),
# which learners transfer directly into English as double negation.
DOUBLE_NEGATION_RULES = [
    {
        "pattern": r"\b(don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|never|no)\s+\w*\s*(nothing|nobody|nowhere|no one|none|never)\b",
        "error_type": "double_negation",
        "message": 'Avoid double negatives: use "I don\'t know anything" not "I don\'t know nothing" (Romanian "nu știu nimic" = I don\'t know nothing).',
        "severity": 3,
        "source": "Romanian negative concord — GALR (2008) vol.I p.653; L1 transfer documented in Swan & Smith (2001) p.141",
    },
    {
        "pattern": r"\bnever\s+\w+\s+nothing\b",
        "error_type": "double_negation",
        "message": 'Double negative: use "never … anything" not "never … nothing".',
        "severity": 3,
        "source": "Romanian negative concord — GALR (2008) vol.I p.653",
    },
]

# Category 5: Romanian false friends and direct translations
FALSE_FRIENDS_RULES = [
    {
        "pattern": r"\bmake\s+a\s+photo\b",
        "error_type": "false_friend_make_take",
        "message": 'Use "take a photo", not "make a photo" (Romanian "a face o poză" → direct translation error).',
        "severity": 2,
        "source": "Popescu (2013) — Romanian-English false cognates in learner corpus",
    },
    {
        "pattern": r"\bactually\b.*\b(now|currently|at\s+the\s+moment)\b|\b(now|currently)\b.*\bactually\b",
        "error_type": "false_friend_actually",
        "message": '"Actually" means "in fact", not "currently". Use "currently" or "at the moment" for the present time (Romanian "actual" = current).',
        "severity": 2,
        "source": "Popescu (2013) — false friends: 'actual/actually' vs 'current/currently'",
    },
    {
        "pattern": r"\beventually\s+(all|every|each)\b",
        "error_type": "false_friend_eventually",
        "message": '"Eventually" means "in the end", not "possibly". Romanian "eventual" = possibly.',
        "severity": 2,
        "source": "Popescu (2013) false cognate analysis",
    },
    {
        "pattern": r"\bsympathetic\s+(person|people|man|woman|guy|character)\b",
        "error_type": "false_friend_sympathetic",
        "message": '"Sympathetic" means "showing understanding/compassion", not "likeable". Use "nice", "pleasant", or "likeable" (Romanian "simpatic" = nice/pleasant).',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) — semantic false cognates",
    },
]

# Category 7: Collocational errors — Popescu (2013) ELTC corpus
# Empirical finding: 377/854 errors (44 %) in 30 Romanian EFL students were
# collocational. This is the largest single error category. Patterns below are
# taken directly from the article's examples (Table 1 + body text):
#   "in vacation" → "on vacation" (prepositional phrase)
#   "the building gets into fire" → "catches fire" (V+N)
#   "induce pressure on market" → "put pressure on market" (V+N)
#   "intern market" → "domestic market" (Adj+N)
#   "want to benefice of" → "benefit from" (V+Prep)
#   "at first of January" → "starting with January 1st"
# Article also lists V+Prep canonical pairs: participate IN, change INTO, import FROM
COLLOCATION_RULES = [
    # Prepositional phrase: "in vacation" → "on vacation"
    {
        "pattern": r"\bin\s+vacation\b",
        "error_type": "collocation_on_vacation",
        "message": 'Use the prepositional phrase "on vacation", not "in vacation".',
        "severity": 1,
        "source": "Popescu (2013) ELTC corpus — prepositional phrase collocation error (Table 1)",
    },
    # V+N: "get into fire" → "catch fire"
    {
        "pattern": r"\b(gets?|got|getting|get)\s+(in|into)\s+fire\b",
        "error_type": "collocation_catch_fire",
        "message": '"catch fire" is the correct V+N collocation — not "get into fire".',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+N collocation example (p.4)",
    },
    # V+N: "induce/create/make pressure" → "put pressure"
    {
        "pattern": r"\b(induce|induces|induced|create|creates|created|make|makes|made)\s+pressure\s+on\b",
        "error_type": "collocation_put_pressure",
        "message": 'Use the V+N collocation "put pressure on" — not "induce/create/make pressure on".',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+N collocation example (p.4)",
    },
    # Adj+N: "intern market/economy" → "domestic market/economy" (Romanian "intern")
    {
        "pattern": r"\bintern\s+(market|markets|production|trade|economy|consumption|policy|affairs)\b",
        "error_type": "collocation_intern_domestic",
        "message": 'Use "domestic" not "intern" for markets/economy (Romanian "intern" is a false cognate; correct Adj+N: "domestic market").',
        "severity": 2,
        "source": "Popescu (2013) ELTC — Adj+N collocation error (p.4)",
    },
    # V+Prep: "benefice of/from" → "benefit from"
    {
        "pattern": r"\bbenefice\s+(of|from)\b|\bbenefit\s+of\b",
        "error_type": "collocation_benefit_from",
        "message": 'Use V+Prep "benefit from" or "take advantage of". "Benefice" is not standard English.',
        "severity": 2,
        "source": "Popescu (2013) ELTC — inaccurate lexical rendition (p.4)",
    },
    # V+Prep: "participate at/to" → "participate in"
    {
        "pattern": r"\bparticipate(s|d)?\s+(at|to)\b",
        "error_type": "collocation_participate_in",
        "message": 'V+Prep "participate IN" — not "participate at/to" (Romanian "a participa la").',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+Prep canonical pair listed in article",
    },
    # V+Prep: "depend of" → "depend on"
    {
        "pattern": r"\bdepends?\s+of\b|\bdepended\s+of\b",
        "error_type": "collocation_depend_on",
        "message": 'V+Prep "depend ON" — not "depend of" (Romanian "a depinde de").',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+Prep collocation error (L1 transfer)",
    },
    # V+Prep: "discuss about" → "discuss" (transitive, no preposition)
    {
        "pattern": r"\bdiscuss(es|ed|ing)?\s+about\b",
        "error_type": "collocation_discuss",
        "message": '"discuss" takes a direct object — say "discuss the topic", not "discuss about the topic".',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+Prep over-extension error",
    },
    # V+N: "take a decision" → "make a decision" (Romanian "a lua o decizie")
    {
        "pattern": r"\b(take|takes|took|taking)\s+a\s+decision\b",
        "error_type": "collocation_make_decision",
        "message": 'V+N collocation "make a decision" is preferred in English (Romanian "a lua o decizie" → L1 transfer).',
        "severity": 1,
        "source": "Popescu (2013) ELTC — V+N collocation, Romanian L1 transfer",
    },
    # V+N+Prep: "pay attention at" → "pay attention to"
    {
        "pattern": r"\bpay\s+attention\s+at\b",
        "error_type": "collocation_pay_attention_to",
        "message": '"pay attention TO" is the correct V+N+Prep collocation — not "pay attention at".',
        "severity": 2,
        "source": "Popescu (2013) ELTC — V+N+Prep collocation error",
    },
    # Prep phrase: "at first of [month]" → "on the first of [month]" or "on [month] 1st"
    {
        "pattern": r"\bat\s+first\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b",
        "error_type": "collocation_first_of_month",
        "message": 'Use "on the first of [month]" or "on [month] 1st" — not "at first of …" (Romanian "la întâi de …").',
        "severity": 2,
        "source": "Popescu (2013) ELTC — date prepositional phrase error (p.4)",
    },
]


# Category 6: Tense / aspect errors — Romanian lacks progressive
TENSE_RULES = [
    # Using simple present instead of progressive for ongoing actions
    {
        "pattern": r"\b(i|he|she|we|they|you)\s+(cook|eat|drink|read|write|work|study|sleep|run|walk|talk|speak|listen|watch)\s+(now|right now|at the moment|currently|at present)\b",
        "error_type": "tense_present_progressive",
        "message": 'Use present progressive for actions happening now: "I am cooking now" not "I cook now" (Romanian has no progressive aspect).',
        "severity": 2,
        "source": "Pungă & Pârlog (2015) — lack of progressive aspect in Romanian L1",
    },
]

# All rules combined
ALL_RULES = (
    ARTICLE_RULES
    + PREPOSITION_RULES
    + WORD_ORDER_RULES
    + DOUBLE_NEGATION_RULES
    + FALSE_FRIENDS_RULES
    + TENSE_RULES
    + COLLOCATION_RULES
)


# ─────────────────────────────────────────────────────────────────────────────
# DETECTOR
# ─────────────────────────────────────────────────────────────────────────────

def detect_romanian_errors(text: str) -> Dict[str, Any]:
    """
    Detect L1 Romanian interference errors in English learner text.

    Args:
        text: The learner's English text.

    Returns:
        {
            "errors": [{"error_type", "message", "severity", "match", "source"}],
            "error_count": int,
            "severity_score": float,   # 0–100, lower = more errors
            "categories": {"articles": N, "prepositions": N, ...},
            "research": "Pungă & Pârlog (2015)..."
        }

    Severity scale:
        1 = minor (style)
        2 = moderate (communication affected)
        3 = severe (comprehension affected)
    """
    text_lower = text.lower()
    errors: List[Dict] = []
    category_counts: Dict[str, int] = {
        "articles": 0,
        "prepositions": 0,
        "word_order": 0,
        "double_negation": 0,
        "false_friends": 0,
        "tense": 0,
        "collocations": 0,
    }

    # Collect ranges of matched substrings so the frontend can highlight them
    # inline. Each range = (start, end, error_type, severity, message).
    highlights: List[Dict] = []

    for rule in ALL_RULES:
        # Use finditer to capture (start, end) of every match
        re_matches = list(re.finditer(rule["pattern"], text_lower))
        if not re_matches:
            continue
        n = len(re_matches)
        cat = _get_category(rule["error_type"])
        category_counts[cat] = category_counts.get(cat, 0) + n
        errors.append({
            "error_type": rule["error_type"],
            "message": rule["message"],
            "severity": rule["severity"],
            "occurrences": n,
            "source": rule["source"],
        })
        for m in re_matches:
            highlights.append({
                "start": m.start(),
                "end": m.end(),
                "matched_text": text[m.start():m.end()],
                "error_type": rule["error_type"],
                "category": cat,
                "severity": rule["severity"],
                "message": rule["message"],
            })

    # Sort highlights by start position so frontend can render in order
    highlights.sort(key=lambda h: h["start"])

    # Severity score: start at 100, penalize per error weighted by severity
    n_words = max(len(text.split()), 1)
    penalty = sum(
        e["severity"] * e["occurrences"] * (100 / n_words)
        for e in errors
    )
    severity_score = max(0.0, round(100.0 - penalty, 1))

    return {
        "errors": errors,
        "highlights": highlights,
        "error_count": sum(e["occurrences"] for e in errors),
        "severity_score": severity_score,
        "categories": category_counts,
        "research": (
            "Pungă & Pârlog (2015) pp.161–176: Rule-based detection of Romanian L1 interference "
            "(article errors pp.163–164, preposition errors pp.165–166, SVO word order). "
            "Popescu (2013) ELTC corpus (30 Romanian EFL students, 15,555 words): collocational "
            "errors are the largest single category (377/854 = 44 %); also false-cognate analysis. "
            "GALR (2008) vol.I p.653: Romanian obligatory negative concord (L1 source of double negation errors)."
        ),
    }


def _get_category(error_type: str) -> str:
    if "article" in error_type:
        return "articles"
    if "preposition" in error_type:
        return "prepositions"
    if "word_order" in error_type:
        return "word_order"
    if "double_negation" in error_type:
        return "double_negation"
    if "false_friend" in error_type:
        return "false_friends"
    if "tense" in error_type:
        return "tense"
    if "collocation" in error_type:
        return "collocations"
    return "other"

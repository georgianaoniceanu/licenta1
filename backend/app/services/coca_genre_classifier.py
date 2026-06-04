"""
COCA Genre Classifier — full 96-subcategory model
─────────────────────────────────────────────────────────────────────────────

Determines the register/domain profile of a learner's text using the COCA
(Corpus of Contemporary American English) sub-genre frequency table for the
top-60 k lemmas (1-in-10 sample, ≈ 6 100 lemmas, 96 sub-categories).

Source: Davies, M. — Corpus of Contemporary American English (COCA).
File:   articles/lemmas_60k_subgenres.xlsx → coca_genre_data.json

Pre-processed lookup (`coca_genre_data.json`):
    {
      "subcategories": { "<code>": "GROUP:Subname", … },     # 96 entries
      "lemmas":        { "<lemma>": { "<code>": pct, … }, … } # ≈ 5 000 entries
    }

96 sub-categories grouped under 9 top-level genres:
    SPOK   (codes 101–109, 9 channels: ABC, NBC, CBS, CNN, FOX, MSNBC, PBS, NPR, Indep)
    FIC    (codes 114–119, 6: Gen Book, Gen Jrnl, SciFi/Fant, Juvenile, Movies, Fan-Fiction)
    MAG    (codes 123–133, 11: News/Opin, Financial, Sci/Tech, Soc/Arts, Religion,
            Sports, Entertain, Home/Health, Afric-Amer, Children, Women/Men)
    NEWS   (codes 135–142, 8: Misc, News_Intl, News_Natl, News_Local, Money, Life,
            Sports, Editorial)
    ACAD   (codes 144–153, 10: History, Education, Geog/SocSci, Law/PolSci,
            Humanities, Phil/Rel, Sci/Tech, Medicine, Misc, Business)
    Web    (codes 160–169, 10 sub-domains)
    Blog   (codes 171–181, 11 sub-domains)
    Mov    (codes 183–201, 19 movie genres: Action, Adv, Anim, Biog, Comedy, Crime,
            Docum, Drama, Fam, Fantasy, Horror, Music, Myst, Romance, Sci-Fi, …)
    TV     (codes 203–214, 12 TV genres: Action, Adv, Anim, Comedy, Crime, Docum,
            Drama, Game, Horror, Reality, Sci-Fi, Misc)

Algorithm (text-level classification): for each lemma in input, look up its
percentage distribution across the 96 sub-categories, accumulate into a
text-level score vector, normalise to percentages. Aggregate by top-level
group for the headline figure. Return both views:
  • per-group   — 9 top-level percentages (headline radar / bars)
  • per-subcat  — top-N strongest sub-categories (drill-down)
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import re
from enum import Enum
from typing import Dict, Any, List, Tuple


class COCAGenre(str, Enum):
    """
    COCA register/genre domains — readable names used throughout the application.
    Source: Davies, M. — Corpus of Contemporary American English (96 sub-categories).
    """
    ACADEMIC   = "academic"    # scholarly journals, science, law, medicine
    FICTION    = "fiction"     # novels, juvenile fiction, sci-fi, screenplays
    SPOKEN     = "spoken"      # TV/radio interviews, talk shows, news anchors
    NEWSPAPER  = "newspaper"   # national/local news, editorial, money
    MAGAZINE   = "magazine"    # lifestyle, sports, science, religion
    WEB        = "web"         # informational websites, reviews, instructional
    BLOG       = "blog"        # personal, argumentative, promotional writing
    MOVIES     = "movies"      # movie dialogue (action, drama, comedy, sci-fi…)
    TV         = "tv"          # TV-show dialogue (drama, reality, crime…)


# Mapping from COCAGenre readable value → internal COCA corpus code
GENRE_TO_CODE: Dict[str, str] = {
    "academic":  "ACAD",
    "fiction":   "FIC",
    "spoken":    "SPOK",
    "newspaper": "NEWS",
    "magazine":  "MAG",
    "web":       "Web",
    "blog":      "Blog",
    "movies":    "Mov",
    "tv":        "TV",
}

# ─── Lazy-loaded lookup ──────────────────────────────────────────────────────

_DATA_PATH = os.path.join(os.path.dirname(__file__), 'coca_genre_data.json')
_DATA: Dict[str, Any] | None = None

# Top-level group order (display order)
TOP_GROUPS = ('SPOK', 'FIC', 'MAG', 'NEWS', 'ACAD', 'Web', 'Blog', 'Mov', 'TV')

GROUP_LABELS = {
    'SPOK': 'Spoken (TV/Radio)',
    'FIC':  'Fiction',
    'MAG':  'Magazine',
    'NEWS': 'Newspaper',
    'ACAD': 'Academic',
    'Web':  'Web (general)',
    'Blog': 'Blog',
    'Mov':  'Movies',
    'TV':   'TV Shows',
}

GROUP_DESCRIPTIONS = {
    'SPOK': 'Vocabulary typical of TV/radio interviews, talk shows, news anchoring.',
    'FIC':  'Vocabulary typical of novels, juvenile fiction, sci-fi, screenplays.',
    'MAG':  'Vocabulary typical of magazines (sci-tech, religion, sports, lifestyle).',
    'NEWS': 'Vocabulary typical of newspapers (national, local, money, editorial).',
    'ACAD': 'Vocabulary typical of scholarly journals (humanities, science, medicine, law).',
    'Web':  'Vocabulary typical of websites (informational, instructional, legal, reviews).',
    'Blog': 'Vocabulary typical of blog writing (personal, argumentative, promotional).',
    'Mov':  'Vocabulary typical of movie dialogue (action, drama, comedy, sci-fi …).',
    'TV':   'Vocabulary typical of TV-show dialogue (drama, comedy, reality, crime …).',
}


def _load() -> Dict[str, Any]:
    global _DATA
    if _DATA is None:
        try:
            with open(_DATA_PATH, encoding='utf-8') as f:
                _DATA = json.load(f)
        except FileNotFoundError:
            _DATA = {'subcategories': {}, 'lemmas': {}}
    return _DATA


def _top_group(subcat_name: str) -> str:
    """'SPOK:ABC' → 'SPOK' ; 'Mov:Action' → 'Mov'."""
    return subcat_name.split(':', 1)[0]


# ─── Public API ──────────────────────────────────────────────────────────────

def classify_text_genre(text: str, top_n_subcats: int = 10) -> Dict[str, Any]:
    """
    Returns the full COCA genre profile for `text`.

    Args:
      text:           Learner's text.
      top_n_subcats:  How many strongest sub-categories to return (default 10).

    Returns:
      {
        'distribution_groups':   {spoken: pct, fiction: pct, magazine: pct, newspaper: pct,
                                  academic: pct, web: pct, blog: pct, movies: pct, tv: pct},
        'distribution_subcats':  {'SPOK:ABC': pct, ..., 'TV:Misc': pct},   # all 96 raw sub-cats
        'top_subcategories':     [{'name': ..., 'group': readable_genre, 'pct': ...}, ...],
        'dominant_group':        'academic',
        'dominant_label':        'Academic',
        'dominant_description':  'Vocabulary typical of scholarly …',
        'dominant_subcategory':  'ACAD:Sci/Tech',
        'matched_words':         int,
        'total_words':           int,
        'coverage':              float,   # %
        'group_breakdown':       {SPOK: [{name, pct}, ...], ...},   # per-group sub-cats sorted
        'source':                'Davies, M. — COCA, top 60 k lemmas (96 sub-genres)'
      }
    """
    data = _load()
    subcat_lookup = data.get('subcategories', {})  # str-code -> "Group:Sub"
    lemma_lookup = data.get('lemmas', {})           # lemma -> {str-code: pct}

    if not lemma_lookup:
        return _empty()

    tokens = [t for t in re.findall(r"[a-zA-Z]+", text.lower()) if len(t) >= 2]
    total = len(tokens)
    if total == 0:
        return _empty()

    # Accumulate per-subcat scores
    subcat_score: Dict[str, float] = {code: 0.0 for code in subcat_lookup}
    matched = 0

    for tok in tokens:
        dist = lemma_lookup.get(tok)
        if not dist:
            continue
        matched += 1
        for code, pct in dist.items():
            if code in subcat_score:
                subcat_score[code] += pct

    if matched == 0:
        return _empty(total)

    grand_total = sum(subcat_score.values()) or 1.0

    # Distribution across all 96 subcats (named, percentages)
    dist_subcats: Dict[str, float] = {}
    for code, score in subcat_score.items():
        if score == 0:
            continue
        name = subcat_lookup[code]
        dist_subcats[name] = round(score / grand_total * 100, 2)

    # Aggregate by top-level group
    dist_groups: Dict[str, float] = {g: 0.0 for g in TOP_GROUPS}
    for name, pct in dist_subcats.items():
        g = _top_group(name)
        if g in dist_groups:
            dist_groups[g] += pct
    dist_groups = {g: round(v, 1) for g, v in dist_groups.items()}

    # Map internal COCA codes → readable COCAGenre values
    _code_to_readable = {v: k for k, v in GENRE_TO_CODE.items()}

    # Top-N strongest sub-categories (group key converted to readable)
    top_subcats: List[Dict[str, Any]] = sorted(
        (
            {
                'name': n,
                'group': _code_to_readable.get(_top_group(n), _top_group(n)),
                'pct': p,
            }
            for n, p in dist_subcats.items()
        ),
        key=lambda x: -x['pct'],
    )[:top_n_subcats]

    # Per-group breakdown with readable keys
    group_breakdown_raw: Dict[str, List[Dict[str, Any]]] = {g: [] for g in TOP_GROUPS}
    for name, pct in dist_subcats.items():
        g = _top_group(name)
        if g in group_breakdown_raw:
            group_breakdown_raw[g].append({'name': name, 'pct': pct})
    for g in group_breakdown_raw:
        group_breakdown_raw[g].sort(key=lambda x: -x['pct'])

    group_breakdown = {
        _code_to_readable.get(g, g): entries
        for g, entries in group_breakdown_raw.items()
    }

    # Readable distribution_groups and dominant
    dist_groups_readable = {
        _code_to_readable.get(g, g): pct for g, pct in dist_groups.items()
    }

    dominant_code = max(dist_groups, key=dist_groups.get)
    dominant_readable = _code_to_readable.get(dominant_code, dominant_code)
    dominant_subcat = top_subcats[0]['name'] if top_subcats else None

    return {
        'distribution_groups': dist_groups_readable,
        'distribution_subcats': dist_subcats,
        'top_subcategories': top_subcats,
        'dominant_group': dominant_readable,
        'dominant_label': GROUP_LABELS[dominant_code],
        'dominant_description': GROUP_DESCRIPTIONS[dominant_code],
        'dominant_subcategory': dominant_subcat,
        'matched_words': matched,
        'total_words': total,
        'coverage': round(matched / total * 100, 1),
        'group_breakdown': group_breakdown,
        'source': (
            'Davies, M. — Corpus of Contemporary American English (COCA), '
            'top 60 k lemmas, 96 sub-genres (lemmas_60k_subgenres.xlsx)'
        ),
    }


def _empty(total: int = 0) -> Dict[str, Any]:
    return {
        'distribution_groups': {g.value: 0.0 for g in COCAGenre},
        'distribution_subcats': {},
        'top_subcategories': [],
        'dominant_group': None,
        'dominant_label': None,
        'dominant_description': None,
        'dominant_subcategory': None,
        'matched_words': 0,
        'total_words': total,
        'coverage': 0.0,
        'group_breakdown': {g.value: [] for g in COCAGenre},
        'source': 'COCA (Davies)',
    }

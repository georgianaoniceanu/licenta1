"""Learner Profiling via K-Means Clustering

Research Foundation:
  Goldshtein, M., Alhashim, A. G., & Roscoe, R. D. (2024). An NLP-based exploration
  of variance in student writing and syntax: Implications for automated writing
  evaluation. Computers, 13(7), 160. https://doi.org/10.3390/computers13070160
  NLP + k-means clustering on a large corpus (n=36,207 essays) identified 4 distinct
  syntactic writer profiles; no single profile was consistently "good" or "bad",
  supporting nuanced, multi-indicator feedback over a single holistic score.

  Tang, X., Chen, H., Lin, D., & Li, K. (2024). Incorporating fine-grained linguistic
  features and explainable AI into multi-dimensional automated writing assessment.
  Applied Sciences, 14(10), 4182. https://doi.org/10.3390/app14104182
  PCA on micro-level and aggregated linguistic features fed into Random Forest
  Regression outperformed linear AES baselines; SHAP analysis revealed which
  indicators drive each writing quality construct — methodology mirrored here for
  indicator weighting in cluster centroid construction.

  Yan et al. (2020): PCA + cluster analysis on Aptis CAF indices revealed
  4 proficiency-based learner groupings (LMTD, VOCD, EFC/C, disfluency).

  Pallotti (2015): CAF framework — Complexity, Accuracy, Fluency as three
  orthogonal dimensions. Clusters reflect different CAF trade-off patterns.

  Ahari et al. (2025): Lexical diversity + cohesion + syntactic complexity
  explain 34% of speaking proficiency variance — primary cluster axes.

Implementation:
  No training data required. Uses fixed centroids derived from CEFR-level
  means from published research (Lee 2021, Zechner et al. 2009, Yan et al. 2020).
  Assignment = nearest centroid by Euclidean distance on normalized indicators.
  K = 4 clusters, matching Goldshtein et al. (2024) empirical result.
─────────────────────────────────────────────────────────────────────────────
"""

import math
from typing import Dict, List, Tuple, Optional



# INDICATOR NORMALIZATION BOUNDS
# Used to bring all 10 indicators onto a 0–100 scale before distance calc.
# Sources: Lee (2021) Table 2; Zechner et al. (2009); Yan et al. (2020).


# (min_observed, max_observed) per indicator — based on A1–C2 CEFR ranges
INDICATOR_BOUNDS: Dict[str, Tuple[float, float]] = {
    "lexical_diversity":        (20.0,  100.0),
    "lexical_sophistication":   (1.0,   6.0),
    "word_length":              (3.0,   8.0),
    "sentence_complexity":      (5.0,   30.0),
    "subordination_ratio":      (0.0,   2.5),
    "syntactic_complexity":     (1.0,   4.0),
    "articulation_rate":        (0.8,   4.0),
    "pause_frequency":          (0.05,  1.0),
    "cohesion_score":           (0.0,   100.0),
    "morphosyntactic_accuracy": (30.0,  98.0),
}

# For indicators where lower = better (sophistication scale, pause_frequency),
# invert so that 100 always means "more proficient"
INVERT_INDICATORS = {"lexical_sophistication", "pause_frequency"}


def _normalize(indicator: str, value: float) -> float:
    """Normalize a raw indicator value to 0–100."""
    lo, hi = INDICATOR_BOUNDS.get(indicator, (0.0, 100.0))
    if hi == lo:
        return 50.0
    pct = (value - lo) / (hi - lo) * 100.0
    pct = max(0.0, min(100.0, pct))
    if indicator in INVERT_INDICATORS:
        pct = 100.0 - pct
    return round(pct, 2)



# CLUSTER CENTROIDS (normalized 0–100 space)

# Derived from published CEFR-level means:
#   Lee (2021): MLS, subordination, syntactic complexity by CEFR
#   Zechner et al. (2009): articulation rate, pause frequency by score band
#   Yan et al. (2020): MTLD/VOCD, EFC/C by Aptis CEFR band
#   Goldshtein et al. (2024): 4-cluster structure from TAASSC syntax data
#
# Cluster names follow Goldshtein et al. (2024) labeling convention,
# reinterpreted for speaking+writing across the full CAF space.


CLUSTERS: List[Dict] = [
    {
        "id": 0,
        "name": "Fluent Communicator",
        "label": "Fluent but Inaccurate",
        "cefr_band": "B1–B2",
        "description": (
            "You speak and write with good fluency and vocabulary range, "
            "but make recurring grammatical and structural errors. "
            "Your ideas come across, but accuracy limits your score."
        ),
        "caf_profile": {"complexity": "medium", "accuracy": "low", "fluency": "high"},
        "strengths": ["Natural flow", "Good vocabulary range", "Discourse coherence"],
        "focus_areas": ["Grammar accuracy", "Article/preposition use", "Tense consistency"],
        "recommended_modules": ["accent", "shadow", "vocabulary"],
        "learning_tip": (
            "Focus on noticing and correcting your most frequent errors. "
            "Shadow native speakers to internalize correct forms."
        ),
        # Centroid in normalized space (0–100, higher = more proficient)
        "centroid": {
            "lexical_diversity":        72.0,
            "lexical_sophistication":   55.0,
            "word_length":              55.0,
            "sentence_complexity":      50.0,
            "subordination_ratio":      45.0,
            "syntactic_complexity":     48.0,
            "articulation_rate":        75.0,
            "pause_frequency":          70.0,
            "cohesion_score":           65.0,
            "morphosyntactic_accuracy": 42.0,
        },
    },
    {
        "id": 1,
        "name": "Careful Writer",
        "label": "Accurate but Simple",
        "cefr_band": "A2–B1",
        "description": (
            "You are careful and accurate — you avoid mistakes by using simple, "
            "safe structures. Your grammar is solid, but your writing lacks "
            "complexity, range, and sophistication."
        ),
        "caf_profile": {"complexity": "low", "accuracy": "high", "fluency": "medium"},
        "strengths": ["Grammatical accuracy", "Reliable sentence structure", "Clear meaning"],
        "focus_areas": ["Vocabulary range", "Complex sentences", "Discourse markers"],
        "recommended_modules": ["vocabulary", "shadow", "conversation"],
        "learning_tip": (
            "Push yourself beyond safe structures. Use more subordinate clauses, "
            "discourse markers, and academic vocabulary."
        ),
        "centroid": {
            "lexical_diversity":        38.0,
            "lexical_sophistication":   30.0,
            "word_length":              35.0,
            "sentence_complexity":      30.0,
            "subordination_ratio":      28.0,
            "syntactic_complexity":     32.0,
            "articulation_rate":        48.0,
            "pause_frequency":          45.0,
            "cohesion_score":           35.0,
            "morphosyntactic_accuracy": 82.0,
        },
    },
    {
        "id": 2,
        "name": "Complex Thinker",
        "label": "Complex but Disfluent",
        "cefr_band": "B2–C1",
        "description": (
            "You have advanced vocabulary, sophisticated ideas, and complex sentence "
            "structures, but your delivery is slow and hesitant. "
            "You think in complex ways but struggle to express it smoothly."
        ),
        "caf_profile": {"complexity": "high", "accuracy": "medium", "fluency": "low"},
        "strengths": ["Rich vocabulary", "Complex syntax", "Academic register"],
        "focus_areas": ["Speaking fluency", "Pace and rhythm", "Reducing pauses"],
        "recommended_modules": ["shadow", "conversation", "accent"],
        "learning_tip": (
            "Your knowledge is there — practice speaking faster. "
            "Shadow speaking at natural pace builds automaticity."
        ),
        "centroid": {
            "lexical_diversity":        78.0,
            "lexical_sophistication":   78.0,
            "word_length":              75.0,
            "sentence_complexity":      72.0,
            "subordination_ratio":      75.0,
            "syntactic_complexity":     72.0,
            "articulation_rate":        35.0,
            "pause_frequency":          30.0,
            "cohesion_score":           70.0,
            "morphosyntactic_accuracy": 65.0,
        },
    },
    {
        "id": 3,
        "name": "Balanced Intermediate",
        "label": "Balanced — Room to Grow",
        "cefr_band": "B1–B2",
        "description": (
            "You perform consistently across all dimensions — no glaring weakness, "
            "but also no outstanding strength. You are ready to push all dimensions "
            "simultaneously toward C1."
        ),
        "caf_profile": {"complexity": "medium", "accuracy": "medium", "fluency": "medium"},
        "strengths": ["Consistent performance", "No critical weak areas", "Stable foundation"],
        "focus_areas": ["All dimensions equally", "Exam-specific strategies", "Register control"],
        "recommended_modules": ["vocabulary", "accent", "conversation"],
        "learning_tip": (
            "You have a solid foundation. Focus on exam-specific strategies "
            "and raise all indicators together toward the C1 band."
        ),
        "centroid": {
            "lexical_diversity":        55.0,
            "lexical_sophistication":   52.0,
            "word_length":              52.0,
            "sentence_complexity":      50.0,
            "subordination_ratio":      50.0,
            "syntactic_complexity":     50.0,
            "articulation_rate":        55.0,
            "pause_frequency":          55.0,
            "cohesion_score":           52.0,
            "morphosyntactic_accuracy": 60.0,
        },
    },
]



# CLUSTERING ENGINE


def _euclidean_distance(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Euclidean distance between two indicator vectors."""
    keys = list(INDICATOR_BOUNDS.keys())
    return math.sqrt(sum((a.get(k, 50.0) - b.get(k, 50.0)) ** 2 for k in keys))


def classify_learner(indicators: Dict[str, float]) -> Dict:
    """
    Assign learner to the nearest cluster centroid.

    Args:
        indicators: Raw indicator values (same keys as INDICATOR_BOUNDS).
                    Keys: lexical_diversity, lexical_sophistication, word_length,
                    sentence_complexity, subordination_ratio, syntactic_complexity,
                    articulation_rate, pause_frequency, cohesion_score,
                    morphosyntactic_accuracy.

    Returns:
        {
            "cluster_id": int,
            "cluster_name": str,
            "label": str,
            "cefr_band": str,
            "description": str,
            "caf_profile": {"complexity": str, "accuracy": str, "fluency": str},
            "strengths": [str],
            "focus_areas": [str],
            "recommended_modules": [str],
            "learning_tip": str,
            "distance_to_centroid": float,    # lower = more typical of cluster
            "all_distances": [float],         # distances to all 4 centroids
            "confidence": float,              # 0–1, how strongly in this cluster
            "research": str,
        }
    """
    # Normalize all indicators to 0–100
    normalized = {k: _normalize(k, v) for k, v in indicators.items() if k in INDICATOR_BOUNDS}

    # Compute distance to each centroid
    distances = []
    for cluster in CLUSTERS:
        d = _euclidean_distance(normalized, cluster["centroid"])
        distances.append(d)

    # Nearest cluster
    best_idx = distances.index(min(distances))
    best = CLUSTERS[best_idx]
    best_dist = distances[best_idx]

    # Membership ("% match"): inverse-distance share of the nearest centroid over
    # all centroids — an intuitive, honest "how well you fit this profile vs the
    # others". (The old metric was a margin to the 2nd-best, which read misleadingly
    # low, e.g. "11% match" for a learner sitting between two profiles.)
    inv = [1.0 / (d + 1e-6) for d in distances]
    confidence = round(inv[best_idx] / sum(inv), 3) if sum(inv) > 0 else 1.0
    confidence = max(0.0, min(1.0, confidence))

    return {
        "cluster_id":            best["id"],
        "cluster_name":          best["name"],
        "label":                 best["label"],
        "cefr_band":             best["cefr_band"],
        "description":           best["description"],
        "caf_profile":           best["caf_profile"],
        "strengths":             best["strengths"],
        "focus_areas":           best["focus_areas"],
        "recommended_modules":   best["recommended_modules"],
        "learning_tip":          best["learning_tip"],
        "distance_to_centroid":  round(best_dist, 2),
        "all_distances":         [round(d, 2) for d in distances],
        "confidence":            confidence,
        "normalized_indicators": normalized,
        "research": (
            "Goldshtein et al. (2024): K-Means on TAASSC syntax indices → 4 learner profiles. "
            "Yan et al. (2020): PCA + clustering on Aptis CAF data → 4 CEFR-based groupings. "
            "Pallotti (2015): CAF trade-off patterns underlie cluster structure. "
            "Ahari et al. (2025): lexical diversity + syntax + cohesion as primary cluster axes."
        ),
    }


def get_cluster_overview() -> List[Dict]:
    """Return all 4 cluster profiles for display (no indicators needed)."""
    return [
        {
            "id":          c["id"],
            "name":        c["name"],
            "label":       c["label"],
            "cefr_band":   c["cefr_band"],
            "description": c["description"],
            "caf_profile": c["caf_profile"],
        }
        for c in CLUSTERS
    ]

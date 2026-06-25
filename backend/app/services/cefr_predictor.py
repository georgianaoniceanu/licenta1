"""
VocaFlow — CEFR Predictor Service (Ordinal LR + SVM Ensemble)
=============================================================
Loads the Ordinal Logistic Regression + SVM ensemble trained on
1,494 written English texts from the Kaggle CEFR Levelled English Texts
corpus (Montgomery 2023), covering A1-C2, merged into 4 ordinal classes:
A2 (A1+A2), B1, B2, C1-C2 (C1+C2).

Primary model  : mord.LogisticAT — Proportional-odds cumulative link model
                 Respects the ordinal nature of CEFR: A2 < B1 < B2 < C1-C2
                 CV accuracy: ~76.7% (5-fold stratified, written text)
Secondary model: SVM RBF — confirmation vote; models agree 91% of test cases
Ensemble rule  : Both agree → use that class.
                 Disagree   → OrdinalLR wins (ordinal model is primary).
                 Confidence → SVM's calibrated Platt-scaled probability.

Model trained in:  backend/train_cefr_ordinal.py
Model file:        backend/app/models/cefr_ordinal_model.pkl

References
----------
Agresti, A. (2002). Categorical Data Analysis (2nd ed.). Wiley.
  — Proportional-odds / cumulative link model (Section 6.2)
Cortes, C., & Vapnik, V. (1995). Machine Learning, 20(3), 273–297.
  — SVM with RBF kernel
Rennie, J. D. M., & Srebro, N. (2005). ICML 2005.
  — LogisticAT (all-threshold ordinal model) implemented in mord
Montgomery, A. (2023). CEFR Levelled English Texts. Kaggle.
  — Written learner corpus used for training
"""

from __future__ import annotations

import os
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_SERVICE_DIR  = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH   = os.path.join(_SERVICE_DIR, "..", "models", "cefr_ordinal_model.pkl")
_MODEL_PATH   = os.path.normpath(_MODEL_PATH)

# Fallback to legacy RF model if ordinal model not yet generated
_LEGACY_PATH  = os.path.join(_SERVICE_DIR, "..", "models", "cefr_rf_model.pkl")
_LEGACY_PATH  = os.path.normpath(_LEGACY_PATH)

# ── Feature names (10 CAF indicators) ─────────────────────────────────────────
FEATURES = [
    "lexical_diversity",        # MTLD
    "lexical_sophistication",   # Word-frequency rarity 1-6
    "word_length",              # Mean chars per word
    "sentence_complexity",      # MLS words/sentence
    "subordination_ratio",      # Subordinate clauses/T-unit
    "syntactic_complexity",     # MLC words/clause
    "articulation_rate",        # Syllables/phonation-s
    "pause_frequency",          # Pauses/s >250ms
    "cohesion_score",           # TAACO cohesion 0-100
    "morphosyntactic_accuracy", # Error-free clauses/C-unit x100
]

# Legacy RF feature aliases (to accept both naming conventions)
_FEATURE_ALIASES = {
    "speech_rate": "articulation_rate",
    "filler_rate": None,   # ignored — no text equivalent
}

CEFR_LABELS = {0: "A2", 1: "B1", 2: "B2", 3: "C1-C2"}

# ── Lazy-load ─────────────────────────────────────────────────────────────────
_bundle: Optional[dict] = None


def _load_bundle() -> dict:
    global _bundle
    if _bundle is not None:
        return _bundle

    try:
        import joblib
        if os.path.exists(_MODEL_PATH):
            _bundle = joblib.load(_MODEL_PATH)
            logger.info("Ordinal LR+SVM model loaded from %s", _MODEL_PATH)
        elif os.path.exists(_LEGACY_PATH):
            # Legacy RF bundle — wrap in compatible structure
            legacy = joblib.load(_LEGACY_PATH)
            _bundle = {"_legacy_rf": legacy}
            logger.warning("Ordinal model not found; fell back to legacy RF at %s", _LEGACY_PATH)
        else:
            raise FileNotFoundError(
                f"No CEFR model found. Run train_cefr_ordinal.py first."
            )
        return _bundle
    except Exception as exc:
        raise RuntimeError(f"Failed to load CEFR model: {exc}") from exc


# ── Internal helpers ──────────────────────────────────────────────────────────

def _resolve_features(features: dict, model_feats: list) -> np.ndarray:
    """
    Build a 1-row feature vector.
    - Resolves legacy alias names (speech_rate -> articulation_rate).
    - Missing features default to the feature mean (NaN-safe imputation):
      using 0.0 would create large negative z-scores after StandardScaler
      for features with positive means (e.g. cohesion_score mean ~23.5).
      We use np.nan and let the scaler handle it via mean imputation instead,
      but since StandardScaler doesn't support NaN we use explicit per-feature
      means from the training distribution (approximate safe defaults).
    """
    # Safe defaults ≈ training corpus means (written text, Kaggle corpus)
    # These prevent extreme z-scores when a feature is missing from input.
    _SAFE_DEFAULTS = {
        "lexical_diversity":      65.0,   # MTLD mean ~65
        "lexical_sophistication":  4.3,   # long-word ratio mean ~4.3
        "word_length":             4.5,   # mean chars/word ~4.5
        "sentence_complexity":    15.0,   # words/sentence ~15
        "subordination_ratio":     0.30,  # subord/sentence ~0.30
        "syntactic_complexity":    2.0,   # clauses/sentence ~2.0
        "cohesion_score":         24.0,   # discourse markers/100w ~24
        "articulation_rate":       2.5,   # syllables/s ~2.5 (unused by model)
        "pause_frequency":         0.15,  # pauses/s (unused by model)
        "morphosyntactic_accuracy": 70.0, # % error-free (unused by model)
    }

    resolved = {}
    for k, v in features.items():
        canon = _FEATURE_ALIASES.get(k, k)
        if canon is not None:
            resolved[canon] = float(v)

    return np.array(
        [resolved.get(f, _SAFE_DEFAULTS.get(f, 0.0)) for f in model_feats],
        dtype=np.float64,
    ).reshape(1, -1)


def _legacy_rf_predict(features: dict, legacy: dict) -> dict:
    """Fallback: use original RF bundle if ordinal model not available."""
    rf          = legacy["model"]
    model_feats = legacy.get("features", FEATURES[:9])  # RF was 9-feature
    x           = _resolve_features(features, model_feats)

    pred_label = int(rf.predict(x)[0])
    proba      = rf.predict_proba(x)[0]
    classes    = rf.classes_
    # RF was trained with {0:B1, 1:B2, 2:C1-C2} — 3-class
    rf_labels  = {0: "B1", 1: "B2", 2: "C1-C2"}
    all_proba  = {rf_labels[int(c)]: round(float(p), 4)
                  for c, p in zip(classes, proba)}
    confidence = round(float(proba[list(classes).index(pred_label)]), 4)

    return {
        "predicted_cefr":    rf_labels[pred_label],
        "predicted_label":   pred_label,
        "confidence":        confidence,
        "all_probabilities": all_proba,
        "model_info": {
            "algorithm":   "RandomForest (legacy fallback)",
            "n_features":  len(model_feats),
            "cv_accuracy": "~59% (5-fold, 3-class B1/B2/C1-C2)",
        },
    }


# ── Public API ────────────────────────────────────────────────────────────────

def predict_cefr(features: dict) -> dict:
    """
    Predict CEFR level from 10 CAF indicator values.

    Parameters
    ----------
    features : dict
        Keys should match FEATURES list above.
        Legacy aliases (speech_rate, filler_rate) are resolved automatically.
        Missing keys default to 0.0.

    Returns
    -------
    dict with keys:
        predicted_cefr      : str   e.g. "B2"
        predicted_label     : int   0=A2 / 1=B1 / 2=B2 / 3=C1-C2
        confidence          : float SVM Platt-scaled probability of predicted class (0-1)
        all_probabilities   : dict  {cefr_label: probability} from SVM
        model_info          : dict  metadata about the model
    """
    bundle = _load_bundle()

    # ── Legacy RF fallback ────────────────────────────────────────────────────
    if "_legacy_rf" in bundle:
        return _legacy_rf_predict(features, bundle["_legacy_rf"])

    # ── Ordinal LR + SVM ensemble ─────────────────────────────────────────────
    ordinal_lr  = bundle["ordinal_lr"]
    svm         = bundle["svm"]
    scaler      = bundle["scaler"]
    model_feats = bundle.get("features", FEATURES)
    cefr_labels = bundle.get("cefr_labels", CEFR_LABELS)

    # Fail-fast: never silently predict from imputed means when real features
    # are absent — that yields confident but meaningless output. Require every
    # feature the model was trained on (after resolving legacy aliases).
    provided = {_FEATURE_ALIASES.get(k, k) for k in features}
    missing = [f for f in model_feats if f not in provided]
    if missing:
        raise ValueError(
            "Cannot predict CEFR — missing required feature(s): "
            + ", ".join(missing)
            + ". All model features must be supplied (no silent imputation)."
        )

    x_raw = _resolve_features(features, model_feats)     # (1, n_features)
    x_s   = scaler.transform(x_raw)                      # standardised

    # Primary prediction: Ordinal LR (respects A2 < B1 < B2 < C1-C2 ordering)
    pred_lr  = int(ordinal_lr.predict(x_s)[0])

    # Secondary prediction: SVM — used for calibrated Platt probabilities (confidence)
    pred_svm = int(svm.predict(x_s)[0])

    # Design decision: OrdinalLR is always the final classifier.
    # SVM is kept solely for calibrated Platt-scaled class probabilities.
    # Rationale: proportional-odds model is theoretically appropriate for
    # ordinal CEFR levels; SVM treats classes as nominal (Agresti 2002, p.274).
    final_label = pred_lr
    agreement   = (pred_lr == pred_svm)

    # Calibrated probabilities from SVM (Platt scaling, probability=True)
    svm_proba  = svm.predict_proba(x_s)[0]          # shape (n_classes,)
    svm_classes = svm.classes_                        # sorted int labels

    all_proba = {cefr_labels[int(c)]: round(float(p), 4)
                 for c, p in zip(svm_classes, svm_proba)}

    # Confidence = SVM's probability for the final (OrdinalLR-decided) class
    # If final_label is not in SVM's classes (edge case), fall back to 0.5
    try:
        cls_idx    = list(svm_classes).index(final_label)
        confidence = round(float(svm_proba[cls_idx]), 4)
    except ValueError:
        confidence = 0.5

    return {
        "predicted_cefr":    cefr_labels[final_label],
        "predicted_label":   final_label,
        "confidence":        confidence,
        "all_probabilities": all_proba,
        "model_info": {
            "algorithm":       "OrdinalLR + SVM Ensemble",
            "primary_model":   "Ordinal Logistic Regression (mord.LogisticAT, Agresti 2002)",
            "secondary_model": "SVM RBF (Cortes & Vapnik 1995)",
            "ensemble_rule":   "OrdinalLR primary; SVM confirms; disagree -> OrdinalLR",
            "models_agree":    agreement,
            "lr_prediction":   cefr_labels.get(pred_lr, str(pred_lr)),
            "svm_prediction":  cefr_labels.get(pred_svm, str(pred_svm)),
            "n_features":      len(model_feats),
            "cv_accuracy_lr":  str(round(float(bundle.get("cv_accuracy_lr", 0.767)), 4)) if bundle.get("cv_accuracy_lr") is not None else "~76.7% (5-fold, 4-class written)",
            "cv_accuracy_svm": str(round(float(bundle.get("cv_accuracy_svm", 0.751)), 4)) if bundle.get("cv_accuracy_svm") is not None else "~75.1% (5-fold, written)",
            "training_corpus": bundle.get(
                "training_corpus",
                "Kaggle CEFR Levelled English Texts (Montgomery 2023), N=1494 written texts"
            ),
            "reference": "Agresti (2002); Cortes & Vapnik (1995); Rennie & Srebro (2005)",
        },
    }

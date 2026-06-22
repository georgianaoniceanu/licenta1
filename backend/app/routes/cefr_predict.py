"""
VocaFlow — /cefr/predict  endpoint
====================================
POST /cefr/predict
  Accepts 9 CAF indicator values and returns a CEFR level prediction
  produced by the Random Forest model trained on the Cambridge S&I Corpus 2025.

POST /cefr/predict/batch
  Accepts a list of feature dicts; returns predictions for all of them.

GET  /cefr/features
  Returns the list of expected feature names and brief descriptions.

Model details: pilot_study/random_forest_sandi.py
              backend/app/services/cefr_predictor.py
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.services.cefr_predictor import predict_cefr, FEATURES, CEFR_LABELS

router = APIRouter(tags=["CEFR Prediction"])

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CefrFeatures(BaseModel):
    """9 CAF indicator values extracted from a learner speech sample."""
    lexical_diversity:    float = Field(..., ge=0, description="MTLD score (Malvern et al. 2004)")
    speech_rate:          float = Field(..., ge=0, description="Words per minute (CTM timestamps)")
    pause_frequency:      float = Field(..., ge=0, description="Pauses >250ms per minute")
    filler_rate:          float = Field(..., ge=0, description="um/uh per 100 words")
    word_length:          float = Field(..., ge=0, description="Mean characters per word")
    subordination_ratio:  float = Field(..., ge=0, description="Subordinate clauses / T-unit (spaCy)")
    syntactic_complexity: float = Field(..., ge=0, description="Mean Length of Clause in words")
    cohesion_score:       float = Field(..., ge=0, description="Connective density (0-100)")
    sentence_complexity:  float = Field(..., ge=0, description="Mean Length of Utterance in words")

    class Config:
        json_schema_extra = {
            "example": {
                "lexical_diversity":    62.3,
                "speech_rate":          128.5,
                "pause_frequency":      4.2,
                "filler_rate":          2.1,
                "word_length":          4.8,
                "subordination_ratio":  0.45,
                "syntactic_complexity": 7.2,
                "cohesion_score":       18.5,
                "sentence_complexity":  9.4,
            }
        }


class CefrPrediction(BaseModel):
    """Response from the CEFR prediction endpoint."""
    predicted_cefr:    str
    predicted_label:   int
    confidence:        float
    all_probabilities: Dict[str, float]
    model_info:        Dict[str, Any]


class BatchRequest(BaseModel):
    samples: List[CefrFeatures]


class BatchResponse(BaseModel):
    predictions: List[CefrPrediction]
    n_samples:   int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/predict", response_model=CefrPrediction,
             summary="Predict CEFR level from 9 CAF indicators")
def predict(features: CefrFeatures):
    """
    Predict CEFR level (A2 / B1 / B2 / C1-C2) from 9 CAF indicator values.

    The Random Forest model was trained on 438 speakers from the Cambridge
    Speak & Improve Corpus 2025 (Knill et al. 2025).

    **5-fold CV accuracy: 59% ± 5.3%** on 3-class problem (B1 / B2 / C1-C2).

    A2 speakers were excluded from training (only 9 samples in corpus —
    below minimum for reliable classification). VocaFlow targets B1+ learners.
    """
    try:
        result = predict_cefr(features.model_dump())
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")


@router.post("/predict/batch", response_model=BatchResponse,
             summary="Batch CEFR prediction for multiple samples")
def predict_batch(body: BatchRequest):
    """Predict CEFR level for a list of feature dicts in a single request."""
    results = []
    for sample in body.samples:
        try:
            results.append(predict_cefr(sample.model_dump()))
        except Exception as exc:
            raise HTTPException(status_code=500,
                                detail=f"Batch prediction error: {exc}")
    return {"predictions": results, "n_samples": len(results)}


@router.get("/features",
            summary="List expected feature names and descriptions")
def list_features():
    """Returns the 9 CAF features expected by the model, in order."""
    descriptions = {
        "lexical_diversity":    "MTLD — Measure of Textual Lexical Diversity (Malvern et al. 2004)",
        "speech_rate":          "Words per minute from ASR timestamps (Cucchiarini et al. 2002)",
        "pause_frequency":      "Within-utterance pauses >250ms per minute (Lennon 1990)",
        "filler_rate":          "Disfluency markers (um/uh/er/ah) per 100 words",
        "word_length":          "Mean number of characters per content word",
        "subordination_ratio":  "Subordinate clauses per T-unit via spaCy dependency parsing",
        "syntactic_complexity": "Mean Length of Clause in words (Ortega 2003)",
        "cohesion_score":       "Connective density score 0-100 (Crossley & McNamara 2010)",
        "sentence_complexity":  "Mean Length of Sentence / Utterance (Barrot & Agdeppa 2021; Lee 2021 Table 2)",
    }
    return {
        "features":    FEATURES,
        "descriptions": descriptions,
        "cefr_labels": CEFR_LABELS,
        "model":       "RandomForest (n_estimators=300, class_weight=balanced)",
        "corpus":      "Cambridge Speak & Improve Corpus 2025 — N=438 speakers",
        "reference":   "Knill et al. (2025) arXiv:2412.11986",
    }

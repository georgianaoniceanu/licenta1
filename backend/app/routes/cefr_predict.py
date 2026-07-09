"""VocaFlow - /cefr/predict  endpoint

POST /cefr/predict
  Accepts CAF indicator values and returns a CEFR level prediction produced by
  the deployed model: an Ordinal LR + SVM ensemble trained on the Kaggle CEFR
  written-text corpus (Montgomery 2023, N=1,494). A Random Forest on the
  Cambridge Speak & Improve spoken corpus was also studied (pilot_study/), but
  cross-corpus validation showed a modality shift, so the written-text model is
  used in production. See backend/metrics_results.md.

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

# Pydantic schemas 

class CefrFeatures(BaseModel):
    """The 7 lexico-syntactic features the deployed Ordinal LR + SVM model uses."""
    lexical_diversity:    float = Field(..., ge=0, description="MTLD score (Malvern et al. 2004)")
    lexical_sophistication: float = Field(..., ge=0, description="Word-frequency rarity, 1-6 inverse scale (Lee 2021)")
    word_length:          float = Field(..., ge=0, description="Mean characters per word")
    sentence_complexity:  float = Field(..., ge=0, description="Mean Length of Sentence in words")
    subordination_ratio:  float = Field(..., ge=0, description="Subordinate clauses / sentence")
    syntactic_complexity: float = Field(..., ge=0, description="Mean Length of Clause in words")
    cohesion_score:       float = Field(..., ge=0, description="Discourse-marker density (0-100)")

    class Config:
        json_schema_extra = {
            "example": {
                "lexical_diversity":    62.3,
                "lexical_sophistication": 4.3,
                "word_length":          4.8,
                "sentence_complexity":  15.0,
                "subordination_ratio":  0.30,
                "syntactic_complexity": 2.0,
                "cohesion_score":       24.0,
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


#Routes 

@router.post("/predict", response_model=CefrPrediction,
             summary="Predict CEFR level from 7 CAF indicators")
def predict(features: CefrFeatures):
    """
    Predict CEFR level (A2 / B1 / B2 / C1-C2) from CAF indicator values.

    Served by the deployed Ordinal LR + SVM ensemble trained on the Kaggle CEFR
    written-text corpus (Montgomery 2023, N=1,494): 5-fold CV ~76.7%, held-out
    exact 75.3%, adjacent (±1 level) 97.7% (see backend/metrics_results.md).

    Note: a Random Forest trained on the Cambridge Speak & Improve spoken corpus
    (438 speakers) was evaluated as a spoken-domain alternative, but cross-corpus
    validation revealed a modality shift (spoken transcripts lack punctuation →
    inflated sentence-complexity), so the written-text model is used in
    production. The spoken experiment lives in pilot_study/random_forest_sandi.py.
    """
    try:
        result = predict_cefr(features.model_dump())
        return result
    except ValueError as exc:
        # Missing/invalid features — clear 422 instead of a silent guess.
        raise HTTPException(status_code=422, detail=str(exc))
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
    """Returns the 7 lexico-syntactic features the deployed model expects."""
    descriptions = {
        "lexical_diversity":      "MTLD — Measure of Textual Lexical Diversity (Malvern et al. 2004)",
        "lexical_sophistication": "Word-frequency rarity, 1-6 inverse scale (Lee 2021; Laufer & Nation 1995)",
        "word_length":            "Mean number of characters per word",
        "sentence_complexity":    "Mean Length of Sentence in words (Barrot & Agdeppa 2021; Lee 2021 Table 2)",
        "subordination_ratio":    "Subordinate clauses per sentence (Lee 2021; Bardovi-Harlig 1992)",
        "syntactic_complexity":   "Mean Length of Clause in words (Ortega 2003)",
        "cohesion_score":         "Discourse-marker density 0-100 (Crossley & McNamara 2010)",
    }
    return {
        "features":    list(descriptions.keys()),
        "descriptions": descriptions,
        "cefr_labels": CEFR_LABELS,
        "model":       "Ordinal LR (mord.LogisticAT) + SVM RBF ensemble",
        "corpus":      "Kaggle CEFR Levelled English Texts (Montgomery 2023) — N=1,494 written texts",
        "reference":   "Agresti (2002); Rennie & Srebro (2005)",
    }

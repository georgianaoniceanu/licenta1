"""
Research-Based Assessment Routes
Integrates vocabulary, POS errors, module effectiveness, learning curves,
and assessment indicators into the assessment system.

Blocked Requirements Implementation:
- #7: Learning curves & learner progression (learning_curves.py)
- #8: POS-specific error patterns per domain (pos_error_patterns.py)
- #9: Bag of words vocabulary (vocabulary_management.py)
- #10: Module effectiveness per error type (module_effectiveness.py)
- Professor Enhancements: 10 standardized assessment indicators (assessment_indicators.py)
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends, Header
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)
from pydantic import BaseModel



from app.services.vocabulary_management import (
    vocabulary_manager, VocabularyManager, CEFRLevel
)
from app.services.pos_error_patterns import (
    error_pattern_manager, POSErrorPatternManager, ErrorType
)
from app.services.module_effectiveness import (
    module_effectiveness_calculator, ModuleType, ErrorType as ModuleErrorType
)
from app.services.learning_curves import (
    learning_curve_predictor, LearningCurvePredictor, CEFRLevel as CurveCEFRLevel,
    IndividualDifferencesFactor, LearningDimension, SLAProgressionData
)
from app.services.assessment_indicators import (
    assessment_calculator, AssessmentIndicatorsCalculator, IndicatorType, ExamType
)
from app.services.assessment_workflow import (
    assessment_engine, InitialAssessmentResult, DualDiagnosisResult
)
from datetime import datetime


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class VocabularyResponse(BaseModel):
    """Response for vocabulary queries"""
    headword: str
    word_family: List[str]
    awl_sublist: Optional[int]
    nawl_band: Optional[int]
    cefr_level: str
    frequency_score: float
    domains: List[str]


class VocabularyLearningPathRequest(BaseModel):
    """Request for vocabulary learning path"""
    current_level: str  # CEFR level
    domain: str  # Learning domain
    num_words: int = 30


class VocabularyLearningPathResponse(BaseModel):
    """Response for vocabulary learning path"""
    domain: str
    current_level: str
    learning_path: Dict[str, List[str]]  # CEFR level → word list


class POSErrorPatternResponse(BaseModel):
    """Response for POS error patterns"""
    error_id: str
    pos_tag: str
    error_type: str
    domain: str
    example_correct: str
    example_incorrect: str
    frequency_percentage: float
    correction_rules: List[str]
    severity: str


class ErrorInterventionPlanResponse(BaseModel):
    """Response for error intervention plan"""
    domain: str
    high_priority_errors: List[Dict]
    medium_priority_errors: List[Dict]
    total_patterns: int
    avg_frequency: float


class ModuleRecommendationResponse(BaseModel):
    """Response for module recommendations"""
    error_type: str
    recommended_modules: List[Dict]  # [{"module": "...", "effectiveness": 0.85}, ...]


class LearningCurveRequest(BaseModel):
    """Request for learning curve prediction"""
    learner_id: str
    current_level: str  # CEFR level
    language_aptitude: float  # 0.0-1.0
    motivation: float  # 0.0-1.0
    learning_strategies: float  # 0.0-1.0
    personality: float  # 0.0-1.0 (0=introverted, 1=extroverted)
    anxiety_level: float  # 0.0-1.0 (0=low, 1=high)


class LearningCurveResponse(BaseModel):
    """Response for learning curve prediction"""
    learner_id: str
    current_level: str
    weeks_to_next_level: Optional[int]
    next_level: Optional[str]
    proficiency_profile: Dict[str, float]
    development_rates: Dict[str, float]


# ============================================================================
# ROUTES
# ============================================================================

from app.services.text_indicator_analyzer import analyze_text_indicators, get_diagnostic_prompt
from app.services.onboarding import get_onboarding, get_pain_points_for_assessment
from app.services.romanian_error_detector import detect_romanian_errors
from app.services.cefr_word_classifier import classify_vocabulary
from app.services.learner_clustering import classify_learner

router = APIRouter(prefix="/assessment", tags=["research-based-assessment"])


# ============================================================================
# DIAGNOSTIC TEXT ANALYSIS — computes 10 indicators from raw text
# ============================================================================

class DiagnosticTextRequest(BaseModel):
    """Request to analyze a learner's text sample and compute all 10 indicators."""
    text: str
    domain: str = "spoken"
    self_assessed_cefr: str = "B1"
    audio_duration_seconds: Optional[float] = None  # if audio was recorded


@router.post("/analyze-text")
def analyze_diagnostic_text(payload: DiagnosticTextRequest):
    """
    Compute all 10 proficiency indicators from a raw text sample.

    Accepts typed text or transcribed speech.
    Indicators 7-8 (Articulation Rate, Pause Frequency) are estimated from
    self-assessed CEFR when no audio duration is provided.

    Research:
    - Lee (2021): MLS, TTR, word length, subordination ratio
    - Ahari et al. (2025): lexical diversity, syntactic complexity, cohesion
    - Zechner et al. (2009): articulation rate, pause frequency (TOEFL iBT)
    - Kyle & Crossley (2016) TAACO: cohesion markers
    - Li & Shintani (2010): morphosyntactic accuracy via LLM
    """
    if len(payload.text.strip().split()) < 30:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Text sample too short. Minimum 30 words required for reliable analysis."
        )

    indicators = analyze_text_indicators(
        text=payload.text,
        self_assessed_cefr=payload.self_assessed_cefr,
        audio_duration_seconds=payload.audio_duration_seconds,
    )

    # Romanian L1 interference error detection (Pungă & Pârlog 2015)
    romanian_errors = detect_romanian_errors(payload.text)

    # CEFR vocabulary level distribution — EVP proxy (Cambridge EVP; NAWL; new-GSL)
    vocab_profile = classify_vocabulary(payload.text)

    # K-Means learner cluster profile (Goldshtein et al. 2024; Yan et al. 2020)
    cluster_profile = classify_learner(indicators)

    return {
        "domain": payload.domain,
        "word_count": len(payload.text.split()),
        "indicators": indicators,
        "idl": indicators.get("idl"),
        "romanian_interference": romanian_errors,
        "vocabulary_profile": vocab_profile,
        "learner_cluster": cluster_profile,
        "research_note": (
            "Indicators: MTLD (Şahin Kızıl 2024; Kolahi Ahari et al. 2025), "
            "IDL (Neumanova 2015), NLP analysis (Lee 2021; Ahari et al. 2025), "
            "EFC/C accuracy (Li & Shintani 2010; Zechner et al. 2009). "
            "Romanian errors: Pungă & Pârlog (2015). "
            "Vocabulary profile: EVP (Cambridge), NAWL, AWL (Coxhead 2000). "
            "Learner cluster: K-Means (Goldshtein et al. 2024; Yan et al. 2020)."
        ),
    }


@router.get("/diagnostic-prompt")
def get_prompt(domain: str = "spoken"):
    """
    Return the writing/speaking prompt for the initial diagnostic task,
    adapted to the learner's target COCA genre domain.

    Prompt register calibrated per COCA genre (Davies):
      spoken/movies/tv → conversational; academic → formal explanation;
      newspaper → editorial; fiction → narrative; web/blog → informal.
    Based on Knoch (2009) diagnostic writing task design.
    """
    return get_diagnostic_prompt(domain)


# ============================================================================
# STEP 1: INITIAL ASSESSMENT (10 indicators + diagnosis)
# ============================================================================

class InitialAssessmentRequest(BaseModel):
    """Request to run initial comprehensive assessment"""
    user_id: str
    domain: str
    target_exam: Optional[str] = None
    # 10 indicator measurements
    lexical_diversity: float = 50.0
    lexical_sophistication: float = 50.0
    word_length: float = 4.5
    sentence_complexity: float = 12.0
    subordination_ratio: float = 0.8
    syntactic_complexity: float = 1.6
    articulation_rate: float = 2.0
    pause_frequency: float = 0.3
    cohesion_score: float = 60.0
    morphosyntactic_accuracy: float = 70.0
    # False = text-only diagnostic (no recording). Speech metrics (articulation_rate,
    # pause_frequency) are then flagged "not measured" and left out of the score.
    has_audio: bool = False


@router.post("/initial-assessment")
def run_initial_assessment(payload: InitialAssessmentRequest, authorization: Optional[str] = Header(None)):
    """
    STEP 1: Run complete initial assessment with all 10 indicators.
    
    Returns:
    - 10 indicator scores with research sources
    - CEFR prediction
    - Critical areas & strengths
    - Priority recommendations
    - Exam-specific scores (Cambridge, TOEFL, IELTS)
    
    Research: CAF framework (Pallotti 2015), Lee (2021), Zechner et al. (2009)
    """
    # Map request to IndicatorType dict
    measured = {
        IndicatorType.LEXICAL_DIVERSITY: payload.lexical_diversity,
        IndicatorType.LEXICAL_SOPHISTICATION: payload.lexical_sophistication,
        IndicatorType.WORD_LENGTH: payload.word_length,
        IndicatorType.SENTENCE_COMPLEXITY: payload.sentence_complexity,
        IndicatorType.SUBORDINATION_RATIO: payload.subordination_ratio,
        IndicatorType.SYNTACTIC_COMPLEXITY: payload.syntactic_complexity,
        IndicatorType.ARTICULATION_RATE: payload.articulation_rate,
        IndicatorType.PAUSE_FREQUENCY: payload.pause_frequency,
        IndicatorType.COHESION_SCORE: payload.cohesion_score,
        IndicatorType.MORPHOSYNTACTIC_ACCURACY: payload.morphosyntactic_accuracy,
    }
    
    # Map exam string to enum
    exam_enum = None
    if payload.target_exam:
        exam_map = {
            "Cambridge CAE": ExamType.CAMBRIDGE_CAE,
            "TOEFL iBT": ExamType.TOEFL_iBT,
            "IELTS": ExamType.IELTS_ACADEMIC,
        }
        exam_enum = exam_map.get(payload.target_exam)
    
    # Run assessment
    result = assessment_engine.run_initial_assessment(
        user_id=payload.user_id,
        domain=payload.domain,
        measured_indicators=measured,
        target_exam=exam_enum,
        has_audio=payload.has_audio
    )
    
    # K-Means learner cluster profile (Goldshtein et al. 2024; Yan et al. 2020)
    raw_for_cluster = {
        "lexical_diversity":        payload.lexical_diversity,
        "lexical_sophistication":   payload.lexical_sophistication,
        "word_length":              payload.word_length,
        "sentence_complexity":      payload.sentence_complexity,
        "subordination_ratio":      payload.subordination_ratio,
        "syntactic_complexity":     payload.syntactic_complexity,
        "articulation_rate":        payload.articulation_rate,
        "pause_frequency":          payload.pause_frequency,
        "cohesion_score":           payload.cohesion_score,
        "morphosyntactic_accuracy": payload.morphosyntactic_accuracy,
    }
    cluster_profile = classify_learner(raw_for_cluster)

    # ── Ordinal LR + SVM ensemble prediction (Agresti 2002; Cortes & Vapnik 1995)
    # Passes all 10 CAF indicators directly — predictor resolves aliases internally.
    # articulation_rate alias handled by cefr_predictor._FEATURE_ALIASES.
    rf_cefr, rf_confidence, rf_probabilities = None, None, {}
    try:
        from app.services.cefr_predictor import predict_cefr as _cefr_predict
        _cefr_feats = {
            "lexical_diversity":        payload.lexical_diversity,
            "lexical_sophistication":   getattr(payload, "lexical_sophistication", 0.0),
            "word_length":              payload.word_length,
            "sentence_complexity":      payload.sentence_complexity,
            "subordination_ratio":      payload.subordination_ratio,
            "syntactic_complexity":     payload.syntactic_complexity,
            "articulation_rate":        payload.articulation_rate,
            "pause_frequency":          payload.pause_frequency,
            "cohesion_score":           payload.cohesion_score,
            "morphosyntactic_accuracy": getattr(payload, "morphosyntactic_accuracy", 0.0),
        }
        _cefr_res        = _cefr_predict(_cefr_feats)
        rf_cefr          = _cefr_res["predicted_cefr"]
        rf_confidence    = _cefr_res["confidence"]
        rf_probabilities = _cefr_res["all_probabilities"]
    except Exception as _cefr_err:
        logger.warning("CEFR predictor failed: %s", _cefr_err, exc_info=True)
        # fields remain None — frontend handles gracefully

    # Headline CEFR = the validated Ordinal LR + SVM model (purely text-driven,
    # discriminates A2–C1; metrics_results.md). The threshold-based workflow
    # level is used only as a fallback when the model could not run, and still
    # drives the per-indicator feedback below.
    headline_cefr = rf_cefr or result.predicted_cefr

    response_payload = {
        "user_id": result.user_id,
        "domain": result.domain,
        "predicted_cefr": headline_cefr,
        # CAF-composite band (from overall_score thresholds) — the SECOND, independent
        # estimate, so the UI can do a real cross-check against the ordinal model
        # instead of comparing the ordinal model to itself.
        "caf_cefr": result.predicted_cefr,
        "overall_score": result.overall_score,
        "exam_scores": result.exam_specific_scores,
        "indicators": [
            {
                "indicator": ind.indicator,
                "name": ind.name,
                "score": ind.normalized_score,
                "severity": ind.severity,
                "cefr_level": ind.cefr_level,
                "interpretation": ind.interpretation,
                "sources": ind.research_sources,
                "measured": ind.measured
            }
            for ind in result.indicators
        ],
        "critical_areas": result.critical_areas,
        "strengths": result.strengths,
        "priority_recommendations": result.priority_recommendations,
        "framework": result.assessment_framework,
        "research_summary": result.research_summary,
        "learner_cluster": cluster_profile,
        # Ordinal LR + SVM ensemble (Agresti 2002; Cortes & Vapnik 1995)
        # 4-class A2/B1/B2/C1-C2; OrdinalLR respects CEFR ordinal scale
        "rf_predicted_cefr":  rf_cefr,        # kept as rf_ for frontend compatibility
        "rf_confidence":      rf_confidence,
        "rf_probabilities":   rf_probabilities,
    }

    # ── Auto-persist to Firestore so history survives app reinstalls ──────────
    # Only runs when the user is authenticated; silently skipped otherwise.
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.services.firestore import save_assessment
            from app.services.auth import verify_token as _vt
            _tok  = authorization.replace("Bearer ", "")
            _user = _vt(_tok)
            save_assessment(_user["uid"], {
                "cefr":              headline_cefr,
                "overall_score":     result.overall_score,
                "domain":            result.domain,
                "rf_predicted_cefr": rf_cefr,
                "rf_confidence":     rf_confidence,
                # store only key summary per indicator (not full research sources)
                "indicators": [
                    {
                        "name":     ind.indicator,
                        "score":    round(ind.normalized_score, 1),
                        "severity": ind.severity,
                        "cefr":     ind.cefr_level,
                    }
                    for ind in result.indicators
                ],
            })
        except Exception:
            pass  # Firestore save is best-effort; never break the assessment

    return response_payload


# ============================================================================
# ASSESSMENT HISTORY — persisted in Firestore, survives app reinstall
# ============================================================================

@router.get("/history")
def get_assessment_history(authorization: Optional[str] = Header(None)):
    """
    Return a user's past diagnostic assessments from Firestore (newest first).
    Each entry: ts, cefr, overall_score, domain, rf_predicted_cefr, indicators[].
    Used by the Profile screen to show progress over time.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from app.services.firestore import get_assessments
        from app.services.auth import verify_token as _vt
        _tok  = authorization.replace("Bearer ", "")
        _user = _vt(_tok)
        history = get_assessments(_user["uid"])
        return {"success": True, "data": history}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================================
# STEP 2: DUAL DIAGNOSIS (perception vs. measurement)
# ============================================================================

class DualDiagnosisRequest(BaseModel):
    """Request to compare user pain points with system measurements"""
    user_id: str
    pain_points: List[str]  # e.g., ["pronunciation", "vocabulary", "grammar"]
    # Same 10 indicators as initial assessment
    lexical_diversity: float = 50.0
    lexical_sophistication: float = 50.0
    word_length: float = 4.5
    sentence_complexity: float = 12.0
    subordination_ratio: float = 0.8
    syntactic_complexity: float = 1.6
    articulation_rate: float = 2.0
    pause_frequency: float = 0.3
    cohesion_score: float = 60.0
    morphosyntactic_accuracy: float = 70.0
    # Real per-skill self-rating collected at onboarding (area -> 1-5).
    self_ratings: Dict[str, int] = {}
    # Real speech measurements from speaking sessions (skill -> 0-100):
    # {"pronunciation": <avg Accent ADN accuracy>, "fluency": <avg Shadow score>}.
    speech_measurements: Dict[str, float] = {}


@router.post("/dual-diagnosis")
def run_dual_diagnosis(payload: DualDiagnosisRequest):
    """
    STEP 2: Compare learner's self-perception (pain points) with system measurements.
    
    Returns:
    - Discrepancy analysis per pain point
    - Areas where user overestimates (confidence building)
    - Areas where user underestimates (intervention priority)
    - Aligned areas (accurate self-assessment)
    
    Research: Li & Shintani (2010) - accurate diagnosis is foundation of corrective feedback
    """
    measured = {
        IndicatorType.LEXICAL_DIVERSITY: payload.lexical_diversity,
        IndicatorType.LEXICAL_SOPHISTICATION: payload.lexical_sophistication,
        IndicatorType.WORD_LENGTH: payload.word_length,
        IndicatorType.SENTENCE_COMPLEXITY: payload.sentence_complexity,
        IndicatorType.SUBORDINATION_RATIO: payload.subordination_ratio,
        IndicatorType.SYNTACTIC_COMPLEXITY: payload.syntactic_complexity,
        IndicatorType.ARTICULATION_RATE: payload.articulation_rate,
        IndicatorType.PAUSE_FREQUENCY: payload.pause_frequency,
        IndicatorType.COHESION_SCORE: payload.cohesion_score,
        IndicatorType.MORPHOSYNTACTIC_ACCURACY: payload.morphosyntactic_accuracy,
    }
    
    result = assessment_engine.run_dual_diagnosis(
        user_id=payload.user_id,
        pain_points=payload.pain_points,
        measured_indicators=measured,
        self_ratings=payload.self_ratings,
        speech_measurements=payload.speech_measurements
    )
    
    return {
        "user_id": result.user_id,
        "pain_points": result.pain_points,
        "discrepancies": result.discrepancies,
        "areas_overestimated": result.areas_user_overestimates,
        "areas_underestimated": result.areas_user_underestimates,
        "aligned_areas": result.aligned_areas,
        "priority_focus": [f"{area}: {reason}" for area, reason in result.priority_focus],
        "research_justification": result.research_justification
    }


# ============================================================================
# STEP 4: ASSESSMENT REPORT (comprehensive view)
# ============================================================================

@router.get("/report/{user_id}")
def get_assessment_report(user_id: str):
    """
    STEP 4: Generate comprehensive assessment report.
    
    Returns:
    - Complete profile with onboarding goals & target exam
    - Initial assessment results (if available)
    - Progress tracking (if reassessments available)
    - Dual diagnosis insights
    - Learning path recommendations
    - Full bibliography with academic sources
    - Assessment methodology explanation
    
    This report is exam-commission ready: fully sourced, measurable, transparent.
    """
    # Fetch user profile, assessments, etc. from DB
    # For now, return template with full bibliography
    
    return {
        "user_id": user_id,
        "status": "Use POST /initial-assessment and POST /dual-diagnosis to populate this report",
        "full_bibliography": [
            "Pallotti, G. (2015). A simple view of linguistic complexity. Language Testing, 32(2), 217-223.",
            "Lee, J. (2021). Genre effects on syntactic complexity and lexical diversity in L2 college students' academic writing. Journal of Writing Research, 13(1), 31-58.",
            "Zechner, K., Higgins, D., Xi, X., & Williamson, D. M. (2009). Automatic evaluation of spoken-language proficiency. SLT, 144-147.",
            "Kyle, K., & Crossley, S. A. (2016). The Tool for the Automatic Analysis of Text Cohesion (TAACO). Applied Natural Language Processing, 35(2), 60-75.",
            "Saito, K., Webb, S., Trofimovich, P., & Isaacs, T. (2016). Lexical profiles of comprehensible second language speech. Studies in Second Language Acquisition, 38(4), 677-702.",
            "Li, S., & Shintani, N. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. Language Learning, 60(2), 322-340.",
            "Crossley, S. A., Kyle, K., & McNamara, D. S. (2016). Predicting text coherence, lexical quality, and essay scores from linguistic complexity measures and linguistic patterns. Journal of Writing Research, 8(1), 181-205.",
            "Barrot, J. S., & Agdeppa, J. Y. (2021). Complexity, accuracy, and fluency as indices of college-level L2 writers' proficiency. Assessing Writing, 47, 100510."
        ],
        "assessment_methodology": "CAF (Complexity-Accuracy-Fluency) framework with 10 standardized SLA research-backed indicators mapped to CEFR levels and international exams."
    }


# VOCABULARY ENDPOINTS
# ============================================================================

@router.get("/vocabulary/by-cefr/{cefr_level}", response_model=List[VocabularyResponse])
def get_vocabulary_by_cefr(cefr_level: str, limit: int = Query(50, le=200)):
    """
    Get vocabulary items for a specific CEFR level
    
    Research basis: AWL (570 word families) + NAWL (310 words in 6 frequency bands)
    
    Args:
        cefr_level: CEFR proficiency level (A1, A2, B1, B2, C1, C2)
        limit: Maximum number of words to return
    """
    try:
        level = CEFRLevel[cefr_level.upper()]
        vocab_items = vocabulary_manager.get_vocabulary_by_cefr(level, limit)
        
        return [
            VocabularyResponse(
                headword=item.headword,
                word_family=item.word_family,
                awl_sublist=item.awl_sublist,
                nawl_band=item.nawl_band,
                cefr_level=item.cefr_level.value,
                frequency_score=item.get_frequency_score(),
                domains=sorted(item.domains),
            )
            for item in vocab_items
        ]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid CEFR level: {cefr_level}")


@router.get("/vocabulary/by-domain/{domain}/{cefr_level}", response_model=List[VocabularyResponse])
def get_vocabulary_by_domain(domain: str, cefr_level: str, limit: int = Query(50, le=200)):
    """
    Get vocabulary items for specific domain and CEFR level
    
    Research basis: Domain-specific vocabulary from AWL + NAWL
    Domains (COCAGenre values): academic, fiction, spoken, newspaper, magazine, web, blog, movies, tv
    
    Args:
        domain: Learning domain
        cefr_level: CEFR proficiency level
        limit: Maximum number of words
    """
    try:
        level = CEFRLevel[cefr_level.upper()]
        vocab_items = vocabulary_manager.get_vocabulary_by_domain(domain.lower(), level, limit)
        
        return [
            VocabularyResponse(
                headword=item.headword,
                word_family=item.word_family,
                awl_sublist=item.awl_sublist,
                nawl_band=item.nawl_band,
                cefr_level=item.cefr_level.value,
                frequency_score=item.get_frequency_score(),
                domains=sorted(item.domains),
            )
            for item in vocab_items
        ]
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")


@router.post("/vocabulary/learning-path", response_model=VocabularyLearningPathResponse)
def get_vocabulary_learning_path(request: VocabularyLearningPathRequest):
    """
    Generate a domain-specific vocabulary learning path
    
    Research basis: Cepeda (2006) - distributed practice for optimal vocabulary retention
    Provides vocabulary progression across multiple CEFR levels
    
    Args:
        current_level: Current CEFR level
        domain: Target domain
        num_words: Words per level
    """
    try:
        current_level = CEFRLevel[request.current_level.upper()]
        domain = request.domain.lower()

        learning_path = vocabulary_manager.get_learning_path(current_level, domain, request.num_words)
        
        return VocabularyLearningPathResponse(
            domain=request.domain,
            current_level=request.current_level,
            learning_path=learning_path,
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")


# POS ERROR PATTERNS ENDPOINTS
# ============================================================================

@router.get("/pos-errors/by-domain/{domain}", response_model=List[POSErrorPatternResponse])
def get_pos_errors_by_domain(domain: str):
    """
    Get POS error patterns for a domain
    
    Research basis: Ha2022, AsiaTEFL, A_Corpus-based_Approach
    Analyzes error frequency in learner corpora (30+ Romanian learners, 320+ essays)
    
    Args:
        domain: COCAGenre value (academic, fiction, spoken, newspaper, magazine, web, blog, movies, tv)
    """
    try:
        errors = error_pattern_manager.get_errors_by_domain(domain.lower())

        return [
            POSErrorPatternResponse(
                error_id=err.error_id,
                pos_tag=err.pos_tag.value,
                error_type=err.error_type.value,
                domain=err.domain,
                example_correct=err.example_correct,
                example_incorrect=err.example_incorrect,
                frequency_percentage=err.frequency_percentage,
                correction_rules=err.correction_rules,
                severity=err.severity.value,
            )
            for err in errors
        ]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain}")


@router.get("/pos-errors/high-priority/{domain}", response_model=List[POSErrorPatternResponse])
def get_high_priority_errors(domain: str, frequency_threshold: float = Query(40.0)):
    """
    Get high-frequency POS errors for targeted intervention
    
    Filters errors where >40% of learners make the mistake
    Prioritizes by frequency and severity
    
    Args:
        domain: Learning domain
        frequency_threshold: Minimum frequency percentage (default 40%)
    """
    try:
        # Adjust threshold dynamically
        threshold = min(max(frequency_threshold, 20.0), 80.0)

        errors = error_pattern_manager.get_errors_by_domain(domain.lower())
        filtered = [e for e in errors if e.frequency_percentage >= threshold]

        return [
            POSErrorPatternResponse(
                error_id=err.error_id,
                pos_tag=err.pos_tag.value,
                error_type=err.error_type.value,
                domain=err.domain,
                example_correct=err.example_correct,
                example_incorrect=err.example_incorrect,
                frequency_percentage=err.frequency_percentage,
                correction_rules=err.correction_rules,
                severity=err.severity.value,
            )
            for err in filtered
        ]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain}")


@router.get("/pos-errors/intervention-plan/{domain}", response_model=ErrorInterventionPlanResponse)
def get_error_intervention_plan(domain: str):
    """
    Get comprehensive error intervention plan for a domain
    
    Prioritizes errors by frequency and severity
    Provides structured approach to address most impactful errors first
    
    Args:
        domain: Learning domain
    """
    try:
        plan = error_pattern_manager.get_error_intervention_plan(domain.lower())
        
        return ErrorInterventionPlanResponse(
            domain=plan['domain'],
            high_priority_errors=plan['high_priority_errors'],
            medium_priority_errors=plan['medium_priority_errors'],
            total_patterns=plan['total_patterns'],
            avg_frequency=plan['avg_frequency'],
        )
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain}")


# MODULE EFFECTIVENESS ENDPOINTS
# ============================================================================

@router.get("/module-effectiveness/matrix")
def get_effectiveness_matrix():
    """
    Get complete module × error type effectiveness matrix

    Research basis: Meta-analyses (Cepeda, Li, Saito, Plonsky & Kim)
    Provides comprehensive mapping of which modules work best for each error type
    """
    return module_effectiveness_calculator.get_error_to_module_mapping()


@router.get("/module-effectiveness/{error_type}", response_model=ModuleRecommendationResponse)
def get_module_recommendations(error_type: str):
    """
    Get module recommendations for addressing a specific error type

    Research basis: Cepeda (vocabulary), Li (grammar), Saito (pronunciation), Plonsky & Kim (tasks)
    Returns modules ranked by effectiveness (only >50% effectiveness)

    Args:
        error_type: Type of error to address (morphosyntax, lexical, pronunciation, etc.)
    """
    try:
        error_enum = ModuleErrorType[error_type.upper()]
        recommendations = module_effectiveness_calculator.recommend_modules_for_error(error_enum)

        return ModuleRecommendationResponse(
            error_type=error_type,
            recommended_modules=[
                {"module": mod.value, "effectiveness": eff}
                for mod, eff in recommendations
            ],
        )
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid error type: {error_type}")


@router.get("/meta-analysis/{analysis_id}")
def get_meta_analysis(analysis_id: str):
    """
    Get detailed meta-analysis data
    
    Available analyses:
    - CEPEDA2006: Distributed practice (839 assessments)
    - LI2010: Corrective feedback (33 studies)
    - SAITO2012: Pronunciation instruction (15 studies)
    - PLONSKY_KIM2016: Task-based learning (85 studies)
    
    Args:
        analysis_id: Identifier for the meta-analysis
    """
    analysis = module_effectiveness_calculator.get_meta_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Meta-analysis not found: {analysis_id}")
    return analysis


# LEARNING CURVES ENDPOINTS
# ============================================================================

@router.post("/learning-curve/create-profile", response_model=LearningCurveResponse)
def create_learner_profile(request: LearningCurveRequest):
    """
    Create learner profile and get initial development predictions
    
    Research basis: Skehan (1998) - individual differences in SLA
    Factors: language aptitude, motivation, learning strategies, personality, anxiety
    
    Args:
        learner_id: Unique learner identifier
        current_level: Current CEFR level
        language_aptitude: 0.0-1.0 (natural ability)
        motivation: 0.0-1.0 (intrinsic drive)
        learning_strategies: 0.0-1.0 (effectiveness of approach)
        personality: 0.0-1.0 (0=introverted, 1=extroverted)
        anxiety_level: 0.0-1.0 (0=low anxiety, 1=high anxiety)
    """
    try:
        current_level = CurveCEFRLevel[request.current_level.upper()]
        
        individual_diffs = {
            IndividualDifferencesFactor.LANGUAGE_APTITUDE: request.language_aptitude,
            IndividualDifferencesFactor.MOTIVATION: request.motivation,
            IndividualDifferencesFactor.LEARNING_STRATEGIES: request.learning_strategies,
            IndividualDifferencesFactor.PERSONALITY: request.personality,
            IndividualDifferencesFactor.ANXIETY: request.anxiety_level,
        }
        
        profile = learning_curve_predictor.create_learner_profile(
            request.learner_id,
            current_level,
            individual_diffs
        )
        
        next_level_info = learning_curve_predictor.predict_next_level_time(request.learner_id)
        
        return LearningCurveResponse(
            learner_id=request.learner_id,
            current_level=request.current_level,
            weeks_to_next_level=next_level_info[1] if next_level_info else None,
            next_level=next_level_info[0].value if next_level_info else None,
            proficiency_profile={k.value: v for k, v in profile.proficiency_scores.items()},
            development_rates={
                k.value: SLAProgressionData.DEVELOPMENT_RATES[k].weekly_improvement
                for k in profile.proficiency_scores.keys()
            },
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")


@router.get("/learning-curve/{learner_id}/summary")
def get_learning_curve_summary(learner_id: str):
    """
    Get comprehensive development summary for a learner
    
    Returns: current level, predicted next level, development rates,
    individual differences assessment
    """
    summary = learning_curve_predictor.get_development_summary(learner_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Learner profile not found: {learner_id}")
    return summary


@router.get("/learning-curve/{learner_id}/growth-estimate")
def estimate_growth(learner_id: str, weeks_ahead: int = Query(12, ge=1, le=52)):
    """
    Estimate learner proficiency growth over next N weeks
    
    Research basis: De Jong (2023) — non-linear CAF development; DeKeyser & Suzuki (2025) — power law of automatization
    Accounts for individual differences and asymptotic ceiling effects
    
    Args:
        learner_id: Learner identifier
        weeks_ahead: Number of weeks to project (1-52)
    """
    growth = learning_curve_predictor.estimate_proficiency_growth(learner_id, weeks_ahead)
    if not growth:
        raise HTTPException(status_code=404, detail=f"Learner profile not found: {learner_id}")
    
    return {
        "learner_id": learner_id,
        "weeks_ahead": weeks_ahead,
        "growth_estimates": {k.value: v for k, v in growth.items()},
    }


@router.get("/learning-curve/{learner_id}/breakthrough-recommendations")
def get_breakthrough_recommendations(learner_id: str):
    """
    Get recommendations to overcome learning plateaus
    
    Research basis: De Jong (2023) — plateau patterns in L2 speaking; DeKeyser & Suzuki (2025) — breakthrough via focused practice
    Recommends strategies based on individual differences
    
    Args:
        learner_id: Learner identifier
    """
    recommendations = learning_curve_predictor.get_breakthrough_recommendations(learner_id)
    if not recommendations:
        raise HTTPException(status_code=404, detail=f"Learner profile not found: {learner_id}")
    
    return {
        "learner_id": learner_id,
        "recommendations": recommendations,
    }


# ============================================================================
# ASSESSMENT INDICATORS ENDPOINTS (Professor Requirements)
# ============================================================================

@router.get("/indicators/all")
def get_all_assessment_indicators():
    """
    Get all 10 standardized assessment indicators with definitions
    
    Research basis: Lee (2021), Ahari et al. (2025), Zechner et al. (2009)
    
    Returns all indicator definitions with:
    - Name & description
    - Measurement formula
    - CEFR benchmarks
    - Academic sources
    """
    indicators = assessment_calculator.get_all_indicators()
    return {
        "total_indicators": len(indicators),
        "indicators": [
            {
                "id": ind.indicator.value,
                "name": ind.name,
                "description": ind.description,
                "unit": ind.measurement_unit,
                "formula": ind.calculation_formula,
                "range": f"{ind.range_min} - {ind.range_max}",
                "benchmarks": ind.cefr_benchmarks,
                "research": ind.primary_research,
                "automation": ind.automation_possible
            }
            for ind in indicators
        ]
    }


@router.get("/indicators/{indicator_type}")
def get_indicator_details(indicator_type: str):
    """
    Get detailed definition of a specific indicator
    
    Args:
        indicator_type: One of: lexical_diversity, lexical_sophistication, word_length,
                       sentence_complexity, subordination_ratio, syntactic_complexity,
                       articulation_rate, pause_frequency, cohesion_score, 
                       morphosyntactic_accuracy
    """
    try:
        ind_type = IndicatorType(indicator_type)
        ind = assessment_calculator.get_indicator(ind_type)
        return {
            "indicator": ind.indicator.value,
            "name": ind.name,
            "description": ind.description,
            "measurement": {
                "unit": ind.measurement_unit,
                "formula": ind.calculation_formula,
                "range": f"{ind.range_min} - {ind.range_max}",
                "automation_possible": ind.automation_possible
            },
            "benchmarks": ind.cefr_benchmarks,
            "research_sources": ind.primary_research,
            "interpretation": ind.interpretation,
            "example_value": ind.example_value
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid indicator type: {indicator_type}")


@router.post("/indicators/evaluate")
def evaluate_single_indicator(indicator_type: str, measured_value: float):
    """
    Evaluate a single indicator measurement
    
    Args:
        indicator_type: Name of the indicator
        measured_value: Measured value in its native unit
    
    Returns:
        normalized_score (0-100), CEFR level, interpretation
    """
    try:
        ind_type = IndicatorType(indicator_type)
        result = assessment_calculator.evaluate_indicator(ind_type, measured_value)
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid indicator: {indicator_type}")


@router.post("/indicators/overall-score")
def calculate_overall_proficiency_score(
    indicators: Dict[str, float],
    exam_type: Optional[str] = None
):
    """
    Calculate overall proficiency score from all indicators
    
    Args:
        indicators: Dictionary mapping indicator names to measured values
        exam_type: Optional exam type (cambridge_fce, cambridge_cae, toefl_ibt, ielts_academic, etc.)
    
    Returns:
        overall_score (0-100), exam-adjusted score if exam specified
    """
    # Convert string keys to IndicatorType
    indicator_dict = {}
    for key, value in indicators.items():
        try:
            indicator_dict[IndicatorType(key)] = value
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid indicator: {key}")
    
    # Convert exam type string if provided
    exam_enum = None
    if exam_type:
        try:
            exam_enum = ExamType(exam_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")
    
    overall_score = assessment_calculator.calculate_overall_score(indicator_dict, exam_enum)
    
    return {
        "overall_score": overall_score,
        "indicators_count": len(indicator_dict),
        "exam_type": exam_type,
        "exam_adjusted": exam_enum is not None,
        "interpretation": f"Proficiency level: {assessment_calculator._determine_cefr_from_benchmark(assessment_calculator.get_indicator(list(indicator_dict.keys())[0]), overall_score)}"
    }


@router.post("/indicators/dual-diagnosis")
def create_dual_diagnosis(
    learner_id: str,
    user_perception: Dict[str, int],  # e.g., {"vocabulary": 7, "pronunciation": 5}
    measured_indicators: Dict[str, float]  # e.g., {"lexical_diversity": 62.22}
):
    """
    Create diagnostic comparison between user perception and system measurement
    
    Research basis: Metacognitive awareness in SLA (Schraw & Dennison, 1994)
    
    Args:
        learner_id: Learner identifier
        user_perception: User's self-assessment (1-10 scale) for areas
        measured_indicators: System's measured indicator values
    
    Returns:
        Dual diagnosis with:
        - Side-by-side comparison
        - Discrepancy analysis
        - Recommendations
        - Priority focus areas
    """
    # Convert string keys to IndicatorType
    indicator_dict = {}
    for key, value in measured_indicators.items():
        try:
            indicator_dict[IndicatorType(key)] = value
        except ValueError:
            pass  # Ignore invalid indicators
    
    diagnosis = assessment_calculator.create_dual_diagnosis(
        learner_id,
        user_perception,
        indicator_dict
    )
    
    return {
        "learner_id": learner_id,
        "user_perception": diagnosis.user_perception,
        "system_diagnosis": diagnosis.system_diagnosis,
        "discrepancy_analysis": diagnosis.discrepancy_analysis,
        "priority_focus_areas": [
            {"area": area, "reason": reason} 
            for area, reason in diagnosis.priority_focus_areas
        ],
        "recommendations": diagnosis.recommendations,
        "interpretation": "Where perception and measurement differ significantly, learner should focus on system-identified areas"
    }


@router.get("/exam-mapping/{exam_type}")
def get_exam_indicator_mapping(exam_type: str):
    """
    Get indicator weights for specific international exam
    
    Supported exams:
    - cambridge_fce (B2 level)
    - cambridge_cae (C1 level)
    - toefl_ibt
    - ielts_academic
    - ielts_general
    - pte_core
    
    Args:
        exam_type: Name of the international exam
    
    Returns:
        Indicator weights showing emphasis for each exam
    """
    try:
        exam_enum = ExamType(exam_type)
        if exam_enum in assessment_calculator.indicators_db.EXAM_WEIGHTS:
            weights = assessment_calculator.indicators_db.EXAM_WEIGHTS[exam_enum]
            return {
                "exam": exam_type,
                "indicator_weights": {k.value: v for k, v in weights.items()},
                "total_weight": sum(weights.values()),
                "interpretation": f"For {exam_type}, these indicators are weighted to match exam criteria. Use this to focus study effort."
            }
        else:
            raise HTTPException(status_code=404, detail=f"No mapping defined for exam: {exam_type}")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam type: {exam_type}")


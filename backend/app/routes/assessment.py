"""
Assessment, Recommendation & Feedback Routes

POST /assessment/recommend — Get module recommendations
POST /assessment/feedback — Get test-specific feedback
POST /assessment/enroll — Enroll in pilot study
GET /assessment/progress/{participant_id} — Track progress
POST /assessment/baseline — Submit baseline assessment
POST /assessment/posttest — Submit post-test assessment
GET /assessment/validation-report — Study results
GET /assessment/domain-comparison/{user_id} — Compare domain performance
"""

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import sys
import os

# Import implementations
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from module_recommendation_algorithm import (
    ModuleRecommender, AssessmentIndicators, CEFRLevel as AlgoCEFRLevel
)
from feedback_templates import (
    generate_feedback, GrammarAccuracyFeedback, LexicalDiversityFeedback, TargetTest
)
from pilot_study_manager import (
    PilotStudyManager, AssessmentScores, ConsentForm, OfficialTest, CEFRLevel as StudyCEFRLevel,
    ParticipantStatus, GroupAssignment
)

# Import schemas
from app.schemas import (
    AssessmentIndicatorsRequest, CEFRLevel, OfficialTest, DomainType,
    ModuleRecommendationResponse, RecommendationResponse,
    IndicatorFeedbackResponse, FeedbackResponse, LearnerExampleResponse, PracticeSuggestionResponse,
    ParticipantEnrollmentRequest, ParticipantEnrollmentResponse,
    BaselineAssessmentRequest, PostTestAssessmentRequest,
    AssessmentProgressResponse, ValidationReportResponse
)

# Optional services: keep API bootable even if research modules are not present.
try:
    from app.services.domain_comparison import DomainComparison
except Exception:
    DomainComparison = None

try:
    from app.services.dual_diagnosis import DualDiagnosis
except Exception:
    from app.services.assessment_indicators import DualDiagnosis

try:
    from app.services.universal_vocabulary import UniversalVocabularyAnalyzer, VocabularyType
except Exception:
    UniversalVocabularyAnalyzer = None
    VocabularyType = None

router = APIRouter()

# Global study manager instance
study_manager = PilotStudyManager()
study_manager.study_start_date = datetime.now()

# In-memory participant tracking (replace with database in production)
participants_db = {}  # participant_id -> participant data


# ============================================================================
# 0. DOMAIN INFORMATION
# ============================================================================

@router.get("/domains")
async def get_available_domains():
    """Get all available assessment domains and their characteristics"""
    return {
        "domains": [
            {
                "id": "narration",
                "name": "Narration",
                "description": "Storytelling and describing events sequentially",
                "emphasis": ["Fluency", "Coherence", "Verb tenses (past)"],
                "example": "Tell a story about your childhood",
                "cefr_critical_indicators": ["Fluency (WPM)", "Coherence", "WCR (tense accuracy)"]
            },
            {
                "id": "description",
                "name": "Description",
                "description": "Detailed description of objects, places, or people",
                "emphasis": ["Vocabulary", "Coherence", "Adjectives/prepositions"],
                "example": "Describe your favorite place in detail",
                "cefr_critical_indicators": ["MTLD (lexical diversity)", "AWL%", "WCR (adj/prep)"]
            },
            {
                "id": "argumentation",
                "name": "Argumentation",
                "description": "Making arguments and persuading with justifications",
                "emphasis": ["Coherence", "Vocabulary", "Complex structures"],
                "example": "Argue for or against remote work",
                "cefr_critical_indicators": ["Coherence (logic)", "MTLD", "MLS (complexity)"]
            },
            {
                "id": "conversation",
                "name": "Conversation",
                "description": "Interactive dialogue and spontaneous responses",
                "emphasis": ["Fluency", "Pronunciation", "No long pauses"],
                "example": "Have a casual conversation about weekend plans",
                "cefr_critical_indicators": ["Fluency", "Pronunciation", "MicroFluency"]
            },
            {
                "id": "academic",
                "name": "Academic",
                "description": "Formal academic writing and presentations",
                "emphasis": ["Grammar", "Vocabulary", "Formality"],
                "example": "Present research findings or write an essay",
                "cefr_critical_indicators": ["WCR (complex structures)", "MTLD", "AWL%"]
            },
            {
                "id": "technical",
                "name": "Technical",
                "description": "Specialized domain vocabulary and precision",
                "emphasis": ["Specialized vocabulary", "Accuracy", "Clarity"],
                "example": "Explain a medical or legal concept",
                "cefr_critical_indicators": ["AWL% (domain vocab)", "WCR (accuracy)", "MTLD"]
            }
        ]
    }


# ============================================================================
# 1. MODULE RECOMMENDATIONS
# ============================================================================

@router.post("/recommend", response_model=RecommendationResponse)
async def get_module_recommendations(
    indicators: AssessmentIndicatorsRequest,
    cefr_level: CEFRLevel,
    target_test: OfficialTest,
    user_id: str = Header(...),
    domain: DomainType = DomainType.DESCRIPTION,  # NEW: domain parameter
    limit: int = Query(3, ge=1, le=5)
):
    """
    Get personalized module recommendations based on assessment indicators
    
    Returns top N modules ranked by priority, considering domain-specific requirements
    
    Domain types affect indicator weighting:
    - narration: emphasizes fluency + coherence (story flow)
    - description: emphasizes vocabulary + coherence (vivid details)
    - argumentation: emphasizes coherence + grammar (logical persuasion)
    - conversation: emphasizes fluency + pronunciation (real-time interaction)
    - academic: emphasizes grammar + vocabulary (formal precision)
    - technical: emphasizes specialized vocabulary + accuracy
    """
    try:
        # Convert to algorithm format
        algo_indicators = AssessmentIndicators(
            mtld=indicators.mtld,
            awl_percent=indicators.awl_percent,
            mls=indicators.mls,
            mlt=indicators.mlt,
            mlc=indicators.mlc,
            wcr=indicators.wcr,
            pronunciation=indicators.pronunciation,
            fluency_wpm=indicators.fluency_wpm,
            micro_fluency=indicators.micro_fluency,
            coherence=indicators.coherence
        )
        
        # Map CEFR enum
        algo_cefr = AlgoCEFRLevel[cefr_level.value]
        
        # Create recommender with domain parameter
        recommender = ModuleRecommender(
            cefr_level=algo_cefr,
            target_test=target_test.value,
            domain=domain.value  # NEW: pass domain to recommender
        )
        
        # Get recommendations
        recommendations = recommender.recommend(algo_indicators, limit=limit)
        critical_gaps = recommender.identify_critical_gaps(algo_indicators)
        
        # Format response
        recommendation_list = []
        for i, rec in enumerate(recommendations, 1):
            recommendation_list.append(ModuleRecommendationResponse(
                rank=i,
                module_name=rec.module_name,
                severity_score=rec.severity_score,
                target_indicators=rec.target_indicators,
                estimated_hours=rec.estimated_hours,
                expected_improvement=rec.expected_improvement,
                rationale=rec.rationale,
                priority_level=rec.priority_level
            ))
        
        critical_gaps_list = [
            {
                "indicator": gap.indicator,
                "learner_score": round(gap.learner_score, 3),
                "cefr_threshold": round(gap.cefr_threshold, 3),
                "severity": round(gap.severity, 2)
            }
            for gap in critical_gaps
        ]
        
        return RecommendationResponse(
            user_id=user_id,
            cefr_level=cefr_level.value,
            target_test=target_test.value,
            recommendations=recommendation_list,
            critical_gaps=critical_gaps_list,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 2. TEST-SPECIFIC FEEDBACK
# ============================================================================

@router.post("/feedback", response_model=FeedbackResponse)
async def get_feedback(
    indicators: AssessmentIndicatorsRequest,
    cefr_level: CEFRLevel,
    target_test: OfficialTest,
    user_id: str = Header(...),
    domain: DomainType = DomainType.DESCRIPTION,  # NEW: domain parameter
):
    """
    Generate test-specific feedback for each indicator
    
    IMPORTANT: Feedback changes per test AND domain!
    - IELTS emphasizes Coherence & Cohesion
    - TOEFL emphasizes Language Use
    - Cambridge emphasizes Grammar & Sophistication
    - Domain affects feedback emphasis (narration vs description vs argumentation, etc)
    - IELTS emphasizes Coherence & Cohesion
    - TOEFL emphasizes Language Use
    - Cambridge emphasizes Grammar & Sophistication
    """
    try:
        feedback_by_indicator = {}
        priority_indicators = []
        
        # Generate feedback for each indicator (all 10 indicators)
        indicator_configs = [
            ("WCR", indicators.wcr, "Grammatical Accuracy"),
            ("MTLD", indicators.mtld, "Lexical Diversity"),
            ("AWL", indicators.awl_percent, "Vocabulary Coverage"),
            ("MLS", indicators.mls, "Sentence Complexity"),
            ("MLT", indicators.mlt, "T-unit Complexity"),
            ("MLC", indicators.mlc, "Clause Complexity"),
            ("Coherence", indicators.coherence, "Discourse Coherence"),
            ("Pronunciation", indicators.pronunciation, "Pronunciation Clarity"),
            ("Articulation", indicators.fluency_wpm, "Articulation Rate"),
            ("Micro-Fluency", indicators.micro_fluency, "Speech Micro-Fluency"),
        ]
        
        for indicator_name, score, display_name in indicator_configs:
            try:
                # Convert test name to TargetTest enum
                test_enum = TargetTest.IELTS  # default
                if "TOEFL" in target_test.value.upper():
                    test_enum = TargetTest.TOEFL
                elif "CAMBRIDGE" in target_test.value.upper():
                    test_enum = TargetTest.CAMBRIDGE
                elif "IELTS" in target_test.value.upper():
                    test_enum = TargetTest.IELTS
                
                # Get test-specific feedback
                feedback_obj = generate_feedback(
                    indicator_name=indicator_name,
                    score=score,
                    target_test=test_enum,
                    cefr_level=CEFRLevel[cefr_level.value],
                    examples=[]  # Would be populated from learner's actual work
                )
                
                # Check if feedback was generated
                if feedback_obj is None:
                    continue
                
                # Determine severity
                severity_map = {
                    0.7: "🟢 LOW",
                    0.5: "🟡 MEDIUM", 
                    0.3: "🟡 HIGH",
                    0.0: "🔴 CRITICAL"
                }
                severity = next(
                    (s for threshold, s in sorted(severity_map.items(), reverse=True) 
                     if score <= threshold),
                    "🟢 LOW"
                )
                
                # Map to response model
                feedback_response = IndicatorFeedbackResponse(
                    indicator=indicator_name,
                    learner_score=score,
                    target_score=get_cefr_threshold(indicator_name, cefr_level),
                    cefr_level=cefr_level.value,
                    severity=severity,
                    diagnosis=feedback_obj.diagnosis,
                    learner_examples=[
                        LearnerExampleResponse(
                            text=ex.text,
                            issue_description=ex.issue_description,
                            correct_version=ex.correct_version
                        )
                        for ex in feedback_obj.learner_examples
                    ],
                    test_specific_insight=feedback_obj.test_specific_insight,
                    strategy=feedback_obj.strategy,
                    timeline_weeks=feedback_obj.timeline_weeks,
                    practice_suggestions=[
                        PracticeSuggestionResponse(
                            module=sug.module,
                            activity=sug.activity,
                            duration_minutes=sug.duration_minutes,
                            notes=sug.notes
                        )
                        for sug in feedback_obj.practice_suggestions
                    ],
                    expected_improvement=f"{score:.2f} → {min(score + 0.15, 1.0):.2f}",
                    markdown_output=feedback_obj.to_markdown()
                )
                
                feedback_by_indicator[indicator_name] = feedback_response
                
                # Track priority (low scores = high priority)
                if score < 0.5:
                    priority_indicators.append(indicator_name)
                    
            except Exception as e:
                print(f"Error generating feedback for {indicator_name}: {e}")
        
        return FeedbackResponse(
            user_id=user_id,
            cefr_level=cefr_level.value,
            target_test=target_test.value,
            feedback_by_indicator=feedback_by_indicator,
            overall_diagnosis=f"Based on {target_test.value} rubric: {len(priority_indicators)} indicators need attention",
            priority_order=priority_indicators,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_cefr_threshold(indicator: str, cefr_level: CEFRLevel) -> float:
    """Get CEFR threshold for indicator (simplified)"""
    thresholds = {
        "A2": {"WCR": 0.45, "MTLD": 0.30, "Coherence": 0.40, "Pronunciation": 0.70, "Fluency": 100},
        "B1": {"WCR": 0.60, "MTLD": 0.40, "Coherence": 0.55, "Pronunciation": 0.75, "Fluency": 130},
        "B2": {"WCR": 0.75, "MTLD": 0.50, "Coherence": 0.70, "Pronunciation": 0.85, "Fluency": 150},
        "C1": {"WCR": 0.88, "MTLD": 0.65, "Coherence": 0.85, "Pronunciation": 0.92, "Fluency": 170},
    }
    
    indicator_short = indicator.split()[0]  # Handle multi-word indicators
    return thresholds.get(cefr_level.value, {}).get(indicator_short, 0.5)


# ============================================================================
# 3. PILOT STUDY ENROLLMENT
# ============================================================================

@router.post("/enroll", response_model=ParticipantEnrollmentResponse)
async def enroll_participant(
    request: ParticipantEnrollmentRequest
):
    """
    Enroll new participant in pilot study
    
    Returns anonymous participant ID (P001, P002, etc)
    """
    try:
        # Convert CEFR enum to study manager format
        study_cefr = StudyCEFRLevel[request.cefr_baseline_level.value]
        study_test = OfficialTest[request.target_test.name]
        
        # Enroll
        participant_id = study_manager.enroll_participant(
            l1=request.l1,
            cefr_level=study_cefr,
            target_test=study_test,
            recruitment_method=request.recruitment_method or ""
        )
        
        # Store in memory
        participants_db[participant_id] = {
            "l1": request.l1,
            "cefr_baseline": request.cefr_baseline_level.value,
            "target_test": request.target_test.value,
            "enrolled_date": datetime.now().isoformat(),
            "status": "consented"
        }
        
        return ParticipantEnrollmentResponse(
            participant_id=participant_id,
            status="consented",
            enrollment_date=datetime.now().isoformat(),
            message=f"Successfully enrolled. Your anonymous ID is {participant_id}. Please proceed with baseline assessment."
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 4. BASELINE ASSESSMENT SUBMISSION
# ============================================================================

@router.post("/baseline")
async def submit_baseline_assessment(
    request: BaselineAssessmentRequest
):
    """Submit baseline assessment for pilot study participant"""
    try:
        # Convert to algorithm format
        scores = AssessmentScores(
            mtld=request.indicators.mtld,
            awl_percent=request.indicators.awl_percent,
            mls=request.indicators.mls,
            mlt=request.indicators.mlt,
            mlc=request.indicators.mlc,
            wcr=request.indicators.wcr,
            pronunciation=request.indicators.pronunciation,
            fluency_wpm=request.indicators.fluency_wpm,
            micro_fluency=request.indicators.micro_fluency,
            coherence=request.indicators.coherence
        )
        
        # Record in study manager
        success = study_manager.add_baseline_assessment(
            participant_id=request.participant_id,
            scores=scores,
            system_cefr=request.system_cefr_prediction.value,
            writing_sample=request.writing_sample
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Update tracking
        participants_db[request.participant_id]["status"] = "baseline_completed"
        participants_db[request.participant_id]["baseline_cefr"] = request.system_cefr_prediction.value
        
        return {
            "participant_id": request.participant_id,
            "status": "baseline_completed",
            "message": "Baseline assessment recorded. Awaiting randomization to treatment/control group.",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 5. POST-TEST ASSESSMENT SUBMISSION
# ============================================================================

@router.post("/posttest")
async def submit_posttest_assessment(
    request: PostTestAssessmentRequest
):
    """Submit post-test assessment and official test score"""
    try:
        # Convert to algorithm format
        scores = AssessmentScores(
            mtld=request.indicators.mtld,
            awl_percent=request.indicators.awl_percent,
            mls=request.indicators.mls,
            mlt=request.indicators.mlt,
            mlc=request.indicators.mlc,
            wcr=request.indicators.wcr,
            pronunciation=request.indicators.pronunciation,
            fluency_wpm=request.indicators.fluency_wpm,
            micro_fluency=request.indicators.micro_fluency,
            coherence=request.indicators.coherence
        )
        
        # Record post-test
        success = study_manager.add_post_test_assessment(
            participant_id=request.participant_id,
            scores=scores,
            system_cefr=request.system_cefr_prediction.value
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        # Record official test score
        study_test = OfficialTest[request.official_test.name]
        study_manager.add_official_test_score(
            participant_id=request.participant_id,
            official_test=study_test,
            cefr_band=request.official_cefr_band.value
        )
        
        # Update tracking
        participants_db[request.participant_id]["status"] = "post_test_completed"
        participants_db[request.participant_id]["posttest_cefr"] = request.system_cefr_prediction.value
        
        return {
            "participant_id": request.participant_id,
            "status": "post_test_completed",
            "message": "Post-test assessment and official score recorded. Thank you for completing the study!",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 6. PROGRESS TRACKING
# ============================================================================

@router.get("/progress/{participant_id}", response_model=AssessmentProgressResponse)
async def get_participant_progress(participant_id: str):
    """Get participant's study progress"""
    try:
        if participant_id not in participants_db:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        p_data = participants_db[participant_id]
        
        # Calculate improvement
        baseline_cefr = p_data.get("baseline_cefr")
        posttest_cefr = p_data.get("posttest_cefr")
        improvement = None
        if baseline_cefr and posttest_cefr:
            cefr_numeric = {"A2": 1.0, "B1": 2.0, "B2": 3.0, "C1": 4.0}
            improvement = cefr_numeric.get(posttest_cefr, 0) - cefr_numeric.get(baseline_cefr, 0)
        
        return AssessmentProgressResponse(
            participant_id=participant_id,
            status=p_data.get("status", "enrolled"),
            group_assignment=p_data.get("group", None),
            baseline_cefr=baseline_cefr,
            posttest_cefr=posttest_cefr,
            improvement=improvement,
            adherence_percentage=p_data.get("adherence", 0.0),
            phase=get_study_phase(p_data.get("status", "enrolled"))
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_study_phase(status: str) -> str:
    """Get current study phase based on status"""
    phases = {
        "recruited": "Phase 1: Recruitment",
        "consented": "Phase 2: Baseline Assessment",
        "baseline_completed": "Phase 3: Treatment/Control",
        "in_treatment": "Phase 3: Treatment/Control",
        "post_test_completed": "Phase 4: Post-Test & Analysis",
    }
    return phases.get(status, "Unknown")


# ============================================================================
# 7. VALIDATION REPORT
# ============================================================================

@router.get("/validation-report", response_model=ValidationReportResponse)
async def get_validation_report():
    """
    Get pilot study validation results
    
    TARGET: Pearson r ≥ 0.75 between system CEFR and official test scores
    """
    try:
        report = study_manager.generate_validation_report()
        
        return ValidationReportResponse(
            study_name=report["study_name"],
            sample_size=report["sample_size"],
            complete_participants=report["complete_participants"],
            correlation_r=report["primary_result"]["correlation_r"],
            p_value=report["primary_result"]["p_value"],
            status=report["primary_result"]["status"],
            by_cefr_level=report["by_cefr_level"],
            by_test_type=report["by_test_type"],
            treatment_effect=report.get("treatment_effect", {}),
            success_criteria=report["success_criteria"],
            timestamp=report["date_report_generated"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export-results")
async def export_results(filepath: str = Query(...)):
    """Export validation study results to JSON"""
    try:
        success = study_manager.export_to_json(filepath)
        if success:
            return {
                "status": "success",
                "filepath": filepath,
                "message": "Results exported successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Export failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 8. DOMAIN COMPARISON & ANALYSIS
# ============================================================================

@router.get("/domain-comparison/{user_id}")
async def get_domain_comparison(
    user_id: str,
    authorization: str = Header(None)
):
    """
    Compare learner performance across domains
    
    Returns:
    - Proficiency scores per domain (0-1 scale)
    - Strength domains (>0.70)
    - Weakness domains (<0.55)
    - Consistency score (0=highly variable, 1=consistent)
    - Pedagogical insights
    - Targeted module recommendations
    
    Domain types:
    - Narration: Sequential storytelling
    - Description: Vivid detail and description
    - Argumentation: Persuasive discourse
    - Conversation: Spontaneous interaction
    - Academic: Formal writing & presentation
    - Technical: Specialized vocabulary & precision
    """
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        # Verify user token
        token = authorization.replace("Bearer ", "")
        from app.services.auth import verify_token
        user = verify_token(token)
        
        # Ensure user_id matches authenticated user
        if user_id != user["uid"]:
            raise HTTPException(status_code=403, detail="User ID mismatch")
        
        if DomainComparison is None:
            raise HTTPException(
                status_code=501,
                detail="Domain comparison module is not available in this build"
            )

        # Get domain comparison
        comparison = DomainComparison.get_domain_comparison(user_id)
        
        return comparison
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dual-diagnosis")
async def analyze_dual_diagnosis(
    user_id: str = Header(...),
    self_assessed_cefr: CEFRLevel = Header(...),
    system_predicted_cefr: CEFRLevel = Header(...),
    indicators: AssessmentIndicatorsRequest = None,
    authorization: str = Header(None)
):
    """
    Dual diagnosis analysis - Compare learner self-perception with system measurement
    
    Identifies:
    - Overconfidence gaps (learner overestimates abilities)
    - Underconfidence gaps (learner underestimates abilities)
    - Specific indicator misalignments
    - Pedagogical strategies to close the gap
    
    This is critical for:
    - Motivation (underconfident learners need encouragement)
    - Realistic goal-setting (overconfident learners need reality check)
    - Personalized learning (different strategies based on gap type)
    """
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        # Verify user token
        token = authorization.replace("Bearer ", "")
        from app.services.auth import verify_token
        user = verify_token(token)
        
        # Ensure user_id matches authenticated user
        if user_id != user["uid"]:
            raise HTTPException(status_code=403, detail="User ID mismatch")
        
        # Convert indicators to dict
        if indicators:
            indicators_dict = {
                "wcr": indicators.wcr,
                "mtld": indicators.mtld,
                "awl_percent": indicators.awl_percent,
                "mls": indicators.mls,
                "mlt": indicators.mlt,
                "mlc": indicators.mlc,
                "coherence": indicators.coherence,
                "pronunciation": indicators.pronunciation,
                "fluency_wpm": indicators.fluency_wpm,
                "micro_fluency": indicators.micro_fluency,
            }
        else:
            indicators_dict = {}
        
        # Perform dual diagnosis analysis
        diagnosis = DualDiagnosis.analyze_self_perception_gap(
            user_id=user_id,
            self_assessed_cefr=CEFRLevel(self_assessed_cefr),
            indicators=indicators_dict,
            system_predicted_cefr=CEFRLevel(system_predicted_cefr)
        )
        
        return diagnosis
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 9. UNIVERSAL VOCABULARY ANALYSIS
# ============================================================================

@router.get("/vocabulary/universal-words/{cefr_level}")
async def get_universal_vocabulary(
    cefr_level: str,
    domain: str = Query(None),
    vocabulary_type: str = Query("universal", regex="^(universal|flexible|specific)$"),
    limit: int = Query(50, ge=10, le=200),
    authorization: str = Header(None)
):
    """
    Get universal vocabulary recommendations
    
    Returns words classified by cross-domain utility:
    - Universal (CV < 0.5): High consistency across domains, 70-80% comprehension
    - Flexible (CV 0.5-0.8): Domain-adaptable, adds specialized understanding
    - Specific (CV > 0.8): Domain-specific, deep specialization
    
    CV = Coefficient of Variation (std_dev / mean_freq)
    Higher CV = more domain-specific, lower utility for general communication
    Lower CV = more universal, better foundation learning
    
    CEFR Levels:
    - A2: 1,000 words (foundation)
    - B1: 2,000 words (conversational)
    - B2: 4,000 words (independent)
    - C1: 8,000 words (proficient)
    - C2: 12,000 words (mastery)
    """
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        if UniversalVocabularyAnalyzer is None:
            raise HTTPException(
                status_code=501,
                detail="Universal vocabulary module is not available in this build"
            )

        # Verify user token
        token = authorization.replace("Bearer ", "")
        from app.services.auth import verify_token
        user = verify_token(token)
        
        # Validate CEFR level
        try:
            cefr = CEFRLevel[cefr_level.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail="Invalid CEFR level. Use A2, B1, B2, C1, or C2")
        
        # Get recommendations
        recommendations = UniversalVocabularyAnalyzer.get_vocabulary_recommendation(
            cefr_level=cefr.value,
            domain=domain,
            vocabulary_type=vocabulary_type
        )
        
        # Add coverage analysis
        coverage = UniversalVocabularyAnalyzer.get_vocabulary_coverage_analysis(
            vocabulary_list=[],  # Would be populated from corpus
            frequencies_by_domain={}  # Would be populated from corpus
        )
        
        return {
            "cefr_level": cefr.value,
            "domain": domain,
            "vocabulary_type": vocabulary_type,
            "limit": limit,
            "recommendations": recommendations,
            "coverage_analysis": coverage,
            "learning_efficiency": {
                "universal_words_effort": "20% of learning time = 70-80% comprehension",
                "flexible_words_effort": "30% of learning time = 90-95% comprehension",
                "specific_words_effort": "50% of learning time = 98%+ comprehension",
                "strategy": "Start with universal words for fastest progress"
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

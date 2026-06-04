"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum


# ============================================================================
# Assessment & Indicators
# ============================================================================

class AssessmentIndicatorsRequest(BaseModel):
    """10 linguistic indicators from assessment"""
    mtld: float = Field(ge=0, le=1, description="Lexical diversity (0-1)")
    awl_percent: float = Field(ge=0, le=1, description="Academic word list percentage")
    mls: float = Field(ge=0, description="Mean length of sentence")
    mlt: float = Field(ge=0, description="Mean length of t-unit")
    mlc: float = Field(ge=0, description="Mean length of clause")
    wcr: float = Field(ge=0, le=1, description="Word correct ratio (grammatical accuracy)")
    pronunciation: float = Field(ge=0, le=1, description="Pronunciation intelligibility %")
    fluency_wpm: float = Field(ge=0, description="Words per minute")
    micro_fluency: float = Field(ge=0, le=1, description="Pause ratio (lower is better)")
    coherence: float = Field(ge=0, le=1, description="Coherence LSA score")


class CEFRLevel(str, Enum):
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"


class OfficialTest(str, Enum):
    IELTS = "IELTS"
    CAMBRIDGE_CAE = "Cambridge CAE"
    CAMBRIDGE_CPE = "Cambridge CPE"
    TOEFL_IBT = "TOEFL iBT"
    APTIS = "Aptis"


class AssessmentMetadata(BaseModel):
    """Assessment context"""
    user_id: str
    cefr_level: CEFRLevel
    target_test: OfficialTest
    domain: str = "academic"  # COCAGenre value: academic, fiction, spoken, newspaper, magazine, web, blog, movies, tv
    l1: str = "Romanian"


# ============================================================================
# Module Recommendation Response
# ============================================================================

class ModuleRecommendationResponse(BaseModel):
    """Single recommended module"""
    rank: int
    module_name: str
    severity_score: float = Field(ge=0, le=1, description="0.0-1.0 priority")
    target_indicators: List[str]
    estimated_hours: float
    expected_improvement: Dict[str, float]  # indicator -> improvement
    rationale: str
    priority_level: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"


class RecommendationResponse(BaseModel):
    """Top N module recommendations"""
    user_id: str
    cefr_level: str
    target_test: str
    recommendations: List[ModuleRecommendationResponse]
    critical_gaps: List[Dict]  # [{indicator, learner_score, threshold, severity}]
    timestamp: str


# ============================================================================
# Feedback Response
# ============================================================================

class LearnerExampleResponse(BaseModel):
    """Example of learner's error"""
    text: str
    issue_description: str
    correct_version: str


class PracticeSuggestionResponse(BaseModel):
    """Suggested exercise"""
    module: str
    activity: str
    duration_minutes: int
    notes: str


class IndicatorFeedbackResponse(BaseModel):
    """Complete feedback for one indicator"""
    indicator: str
    learner_score: float
    target_score: float
    cefr_level: str
    severity: str  # "🔴 CRITICAL", "🟡 HIGH", "🟢 MEDIUM", "🟢 LOW"
    diagnosis: str
    learner_examples: List[LearnerExampleResponse]
    test_specific_insight: str
    strategy: str
    timeline_weeks: int
    practice_suggestions: List[PracticeSuggestionResponse]
    expected_improvement: str  # "0.45 → 0.65"
    markdown_output: str  # Full markdown-formatted feedback


class FeedbackResponse(BaseModel):
    """Feedback for all indicators"""
    user_id: str
    cefr_level: str
    target_test: str
    feedback_by_indicator: Dict[str, IndicatorFeedbackResponse]
    overall_diagnosis: str
    priority_order: List[str]  # Indicators to focus on first
    timestamp: str


# ============================================================================
# Onboarding Profile
# ============================================================================

class LearningGoal(str, Enum):
    """User's primary learning goal"""
    GENERAL = "general"          # General English proficiency
    BUSINESS = "business"        # Business/professional English
    ACADEMIC = "academic"        # Academic preparation
    EXAM_PREP = "exam_prep"      # Exam preparation (IELTS/TOEFL/Cambridge)
    TRAVEL = "travel"            # Practical communication


class PainPoint(str, Enum):
    """Areas where learner struggles"""
    PRONUNCIATION = "pronunciation"
    GRAMMAR = "grammar"
    VOCABULARY = "vocabulary"
    FLUENCY = "fluency"
    LISTENING = "listening"
    WRITING = "writing"
    CONFIDENCE = "confidence"


class OnboardingRequest(BaseModel):
    """User onboarding questionnaire"""
    user_id: str
    learning_goals: LearningGoal
    primary_domain: str  # COCAGenre value: academic, fiction, spoken, newspaper, magazine, web, blog, movies, tv
    pain_points: List[PainPoint]
    target_exam: Optional[OfficialTest] = None
    self_assessed_cefr: CEFRLevel
    study_hours_per_week: int = Field(ge=1, le=60)
    previous_experience: Optional[str] = None  # e.g., "3 years of formal study"


class OnboardingResponse(BaseModel):
    """Onboarding completion response"""
    user_id: str
    profile_created: bool
    learning_path_generated: bool
    initial_modules_recommended: List[str]
    estimated_completion_weeks: int
    next_step: str
    timestamp: str


# ============================================================================
# Pilot Study Enrollment
# ============================================================================

class ConsentFormRequest(BaseModel):
    """Informed consent"""
    participant_id: str
    understands_purpose: bool
    understands_time_commitment: bool
    understands_withdrawal: bool
    data_privacy_agreed: bool


class ParticipantEnrollmentRequest(BaseModel):
    """Enrollment request"""
    l1: str = "Romanian"
    cefr_baseline_level: CEFRLevel
    target_test: OfficialTest
    recruitment_method: Optional[str] = None


class ParticipantEnrollmentResponse(BaseModel):
    """Enrollment result"""
    participant_id: str
    status: str
    enrollment_date: str
    message: str


class BaselineAssessmentRequest(BaseModel):
    """Baseline assessment submission"""
    participant_id: str
    indicators: AssessmentIndicatorsRequest
    system_cefr_prediction: CEFRLevel
    writing_sample: Optional[str] = None


class PostTestAssessmentRequest(BaseModel):
    """Post-test assessment submission"""
    participant_id: str
    indicators: AssessmentIndicatorsRequest
    system_cefr_prediction: CEFRLevel
    official_test: OfficialTest
    official_cefr_band: CEFRLevel


class AssessmentProgressResponse(BaseModel):
    """Participant progress"""
    participant_id: str
    status: str
    group_assignment: Optional[str]
    baseline_cefr: Optional[str]
    posttest_cefr: Optional[str]
    improvement: Optional[float]  # CEFR numeric change
    adherence_percentage: float
    phase: str


# ============================================================================
# Validation Study Report
# ============================================================================

class ValidationReportResponse(BaseModel):
    """Pilot study results"""
    study_name: str
    sample_size: int
    complete_participants: int
    correlation_r: float
    p_value: float
    status: str  # "VALID", "PARTIAL", "NEEDS REVISION"
    by_cefr_level: Dict[str, Dict]
    by_test_type: Dict[str, int]
    treatment_effect: Optional[Dict] = None
    success_criteria: Dict
    timestamp: str

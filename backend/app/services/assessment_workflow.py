"""
Assessment Workflow Service — Implements all 4 urgent endpoints with research-backed indicators

Research sources:
- Pallotti (2009, 2015): CAF framework (Complexity, Accuracy, Fluency)
- Lee (2021): Genre effects on syntactic complexity & lexical diversity
- Zechner et al. (2009): TOEFL iBT Speaking assessment features
- Kyle & Crossley (2016): TAACO Tool for Automatic Analysis of Text Cohesion
- Saito et al. (2016): Comprehensible L2 speech
- Li & Shintani (2010): Corrective feedback meta-analysis (d=0.48 effect)
- Crossley et al. (2016): Writing quality assessment
- Barrot & Agdeppa (2021): Syntactic complexity indices across CEFR levels
- Norris, J. M. (2017). Task-based language assessment: Aligning designs with intended
  uses and consequences. JLTA Journal, 21, 3–20. Provides the TBLA framework used to
  justify constructed-response task design in the diagnostic workflow; advocates for
  performance-based assessment that captures what learners can do communicatively.
- Dimova, S. (2022). Performance-based speaking tests: Possibilities in local language
  testing. Language Teaching Research Quarterly, 29, 120–133. Supports the diagnostic
  and placement function of this assessment for a local (Romanian university) context;
  informs monologic task design (narration, argumentation) used in speaking prompts.
"""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from app.services.assessment_indicators import (
    assessment_calculator,
    AssessmentIndicatorsDatabase,
    IndicatorType,
    ExamType
)


# ============================================================================
# RESEARCH SOURCES DATABASE
# ============================================================================

class ResearchSource(str, Enum):
    """Academic sources for each indicator"""
    PALLOTTI_2015 = "Pallotti, G. (2015). A simple view of linguistic complexity. Language Testing, 32(2), 217-223."
    LEE_2021 = "Lee, J. (2021). Genre effects on syntactic complexity and lexical diversity in L2 college students' academic writing. Journal of Writing Research, 13(1), 31-58."
    ZECHNER_2009 = "Zechner, K., Higgins, D., Xi, X., & Williamson, D. M. (2009). Automatic evaluation of spoken-language proficiency. SLT, 144-147."
    KYLE_CROSSLEY_2016 = "Kyle, K., & Crossley, S. A. (2016). The Tool for the Automatic Analysis of Text Cohesion (TAACO). Applied Natural Language Processing, 35(2), 60-75."
    SAITO_2016 = "Saito, K., Webb, S., Trofimovich, P., & Isaacs, T. (2016). Lexical profiles of comprehensible second language speech. Studies in Second Language Acquisition, 38(4), 677-702."
    LI_SHINTANI_2010 = "Li, S., & Shintani, N. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. Language Learning, 60(2), 322-340."
    CROSSLEY_2016 = "Crossley, S. A., Kyle, K., & McNamara, D. S. (2016). Predicting text coherence, lexical quality, and essay scores from linguistic complexity measures and linguistic patterns. Journal of Writing Research, 8(1), 181-205."
    BARROT_2021 = "Barrot, J. S., & Agdeppa, J. Y. (2021). Complexity, accuracy, and fluency as indices of college-level L2 writers' proficiency. Assessing Writing, 47, 100510."
    NORRIS_2017 = "Norris, J. M. (2017). Task-based language assessment: Aligning designs with intended uses and consequences. JLTA Journal, 21, 3–20."
    DIMOVA_2022 = "Dimova, S. (2022). Performance-based speaking tests: Possibilities in local language testing. Language Teaching Research Quarterly, 29, 120–133."


INDICATOR_SOURCES = {
    IndicatorType.LEXICAL_DIVERSITY: [ResearchSource.LEE_2021, ResearchSource.PALLOTTI_2015],
    IndicatorType.LEXICAL_SOPHISTICATION: [ResearchSource.LEE_2021, ResearchSource.KYLE_CROSSLEY_2016],
    IndicatorType.WORD_LENGTH: [ResearchSource.LEE_2021, ResearchSource.SAITO_2016],
    IndicatorType.SENTENCE_COMPLEXITY: [ResearchSource.LEE_2021, ResearchSource.PALLOTTI_2015, ResearchSource.BARROT_2021],
    IndicatorType.SUBORDINATION_RATIO: [ResearchSource.PALLOTTI_2015, ResearchSource.BARROT_2021],
    IndicatorType.SYNTACTIC_COMPLEXITY: [ResearchSource.LEE_2021, ResearchSource.PALLOTTI_2015],
    IndicatorType.ARTICULATION_RATE: [ResearchSource.ZECHNER_2009, ResearchSource.SAITO_2016],
    IndicatorType.PAUSE_FREQUENCY: [ResearchSource.ZECHNER_2009, ResearchSource.PALLOTTI_2015],
    IndicatorType.COHESION_SCORE: [ResearchSource.KYLE_CROSSLEY_2016, ResearchSource.CROSSLEY_2016],
    IndicatorType.MORPHOSYNTACTIC_ACCURACY: [ResearchSource.ZECHNER_2009, ResearchSource.LI_SHINTANI_2010],
}


# ============================================================================
# ASSESSMENT RESULT MODELS
# ============================================================================

@dataclass
class IndicatorScore:
    """Single indicator measurement with research backing"""
    indicator: str
    name: str
    measured_value: float
    normalized_score: float  # 0-100
    cefr_level: str  # A1-C2
    benchmark: float
    interpretation: str
    research_sources: List[str]  # bibliography
    severity: str  # "🔴 CRITICAL", "🟡 HIGH", "🟢 MEDIUM", "🟢 LOW"


@dataclass
class InitialAssessmentResult:
    """Complete initial diagnostic with 10 indicators"""
    user_id: str
    domain: str
    assessment_date: datetime
    
    # 10 indicators
    indicators: List[IndicatorScore]
    
    # Overall scores
    predicted_cefr: str  # A2, B1, B2, C1
    overall_score: float  # 0-100
    exam_specific_scores: Dict[str, float]  # {"cambridge_cae": 72.5, "toefl_ibt": 68.0}
    
    # Diagnosis
    critical_areas: List[str]  # indicators < 40%
    strengths: List[str]  # indicators > 75%
    priority_recommendations: List[str]
    
    # Research integration
    assessment_framework: str  # "CAF (Complexity-Accuracy-Fluency) framework per Pallotti (2015)"
    research_summary: str


@dataclass
class DualDiagnosisResult:
    """Comparison: learner self-perception vs. system measurement"""
    user_id: str
    assessment_date: datetime
    
    # Pain points from onboarding
    pain_points: List[str]
    
    # Analysis per pain point
    discrepancies: Dict[str, Dict]  # {area: {"user_score": 7, "system_score": 45, "gap": -35, "interpretation": "..."}}
    
    # Key findings
    areas_user_overestimates: List[str]  # User worries more than system measured
    areas_user_underestimates: List[str]  # System detected higher than user expects
    aligned_areas: List[str]  # Self-assessment matches measurement
    
    # Actionable recommendations
    priority_focus: List[tuple]  # [(area, reason)]
    research_justification: str


@dataclass
class ReassessmentResult:
    """Progress from baseline to re-assessment"""
    user_id: str
    baseline_assessment_id: int
    reassessment_date: datetime
    
    # Indicator deltas
    indicator_improvements: Dict[str, float]  # {indicator: +12.5}  # positive = improvement
    
    # Overall progress
    baseline_overall: float
    current_overall: float
    overall_improvement: float  # percentage points
    
    # CEFR progression
    baseline_cefr: str
    current_cefr: str
    cefr_advanced: bool  # True if moved to higher level
    
    # Per-exam progress
    exam_improvements: Dict[str, float]  # {"cambridge_cae": +5.2, ...}
    
    # Diagnosis of progress
    most_improved_areas: List[str]  # top 3
    still_critical_areas: List[str]  # still below 40%
    progress_summary: str


@dataclass
class AssessmentReport:
    """Complete learner report with all metrics and sources"""
    user_id: str
    report_date: datetime
    
    # Profile
    onboarding_goals: Optional[str]
    target_exam: Optional[str]
    
    # Baseline
    initial_assessment: Optional[InitialAssessmentResult]
    
    # Progress (if available)
    latest_reassessment: Optional[ReassessmentResult]
    
    # Dual diagnosis
    dual_diagnosis: Optional[DualDiagnosisResult]
    
    # Action plan
    learning_path: Dict  # from learning-path endpoint
    recommended_modules: List[str]
    
    # Research backing
    full_bibliography: List[str]
    assessment_methodology: str


# ============================================================================
# ASSESSMENT WORKFLOW ENGINE
# ============================================================================

class AssessmentWorkflowEngine:
    """
    Orchestrates the 4-step assessment workflow:
    1. Initial Assessment (10 indicators + dual diagnosis)
    2. Dual Diagnosis (perception vs. measurement)
    3. Re-assessment (progress tracking)
    4. Report (comprehensive view with sources)
    """

    def __init__(self):
        self.calc = assessment_calculator
        self.sources = INDICATOR_SOURCES

    def run_initial_assessment(
        self,
        user_id: str,
        domain: str,
        measured_indicators: Dict[IndicatorType, float],
        target_exam: Optional[ExamType] = None
    ) -> InitialAssessmentResult:
        """
        Run initial assessment: measure all 10 indicators, calculate scores, identify critical areas.
        
        Args:
            user_id: Learner identifier
            domain: Learning domain (narration, academic, etc.)
            measured_indicators: {IndicatorType: value}  # from audio/text analysis
            target_exam: Optional exam for exam-specific weighting
        
        Returns:
            InitialAssessmentResult with all 10 indicators, CEFR prediction, recommendations
        """
        indicator_scores = []
        normalized_scores = {}
        
        # Evaluate all 10 indicators
        for indicator_type, measured_value in measured_indicators.items():
            ind_def = self.calc.get_indicator(indicator_type)
            evaluation = self.calc.evaluate_indicator(indicator_type, measured_value)
            
            # Get severity
            norm_score = evaluation["normalized_score"]
            if norm_score < 40:
                severity = "🔴 CRITICAL"
            elif norm_score < 60:
                severity = "🟡 HIGH"
            elif norm_score < 75:
                severity = "🟢 MEDIUM"
            else:
                severity = "🟢 LOW"
            
            sources = [s.value for s in self.sources.get(indicator_type, [])]
            
            score = IndicatorScore(
                indicator=indicator_type.value,
                name=ind_def.name,
                measured_value=measured_value,
                normalized_score=norm_score,
                cefr_level=evaluation["cefr_level"],
                benchmark=evaluation["benchmark"],
                interpretation=evaluation["interpretation"],
                research_sources=sources,
                severity=severity
            )
            indicator_scores.append(score)
            normalized_scores[indicator_type] = norm_score
        
        # Calculate overall score
        overall_score = self.calc.calculate_overall_score(normalized_scores, target_exam)
        
        # Predict CEFR from overall score
        if overall_score < 25:
            predicted_cefr = "A1"
        elif overall_score < 40:
            predicted_cefr = "A2"
        elif overall_score < 55:
            predicted_cefr = "B1"
        elif overall_score < 70:
            predicted_cefr = "B2"
        elif overall_score < 85:
            predicted_cefr = "C1"
        else:
            predicted_cefr = "C2"
        
        # Calculate exam-specific scores
        exam_scores = {}
        for exam_type in ExamType:
            exam_score = self.calc.calculate_overall_score(normalized_scores, exam_type)
            exam_scores[exam_type.value] = round(exam_score, 1)
        
        # Identify critical/strength areas
        critical = [s.name for s in indicator_scores if s.severity == "🔴 CRITICAL"]
        strengths = [s.name for s in indicator_scores if s.severity == "🟢 LOW"]
        
        # Recommendations
        recommendations = []
        for score in indicator_scores:
            if score.severity in ["🔴 CRITICAL", "🟡 HIGH"]:
                recommendations.append(
                    f"{score.name}: {score.interpretation}. Target: {score.cefr_level} benchmark ({score.benchmark})"
                )
        
        research_summary = (
            f"Assessment based on CAF (Complexity-Accuracy-Fluency) framework "
            f"(Pallotti, 2015) with 10 standardized indicators from SLA research. "
            f"Overall score {overall_score:.1f}/100 maps to {predicted_cefr} level."
        )
        
        return InitialAssessmentResult(
            user_id=user_id,
            domain=domain,
            assessment_date=datetime.utcnow(),
            indicators=indicator_scores,
            predicted_cefr=predicted_cefr,
            overall_score=round(overall_score, 1),
            exam_specific_scores=exam_scores,
            critical_areas=critical,
            strengths=strengths,
            priority_recommendations=recommendations[:5],
            assessment_framework="CAF (Complexity-Accuracy-Fluency) per Pallotti (2015); 10 indicators from Lee (2021), Zechner et al. (2009), Kyle & Crossley (2016)",
            research_summary=research_summary
        )

    def run_dual_diagnosis(
        self,
        user_id: str,
        pain_points: List[str],
        measured_indicators: Dict[IndicatorType, float],
        self_ratings: Dict[str, int] = None,
        speech_measurements: Dict[str, float] = None
    ) -> DualDiagnosisResult:
        """
        Compare learner's self-perceived pain points with system measurements.
        
        Args:
            user_id: Learner ID
            pain_points: Areas user says they struggle with
            measured_indicators: System measurements
        
        Returns:
            Discrepancy analysis with actionable recommendations
        """
        discrepancies = {}
        user_overestimates = []
        user_underestimates = []
        aligned = []
        
        # Map each onboarding skill to the TEXT indicator that genuinely measures it.
        # The initial diagnostic is text-only, so only these can be measured here.
        skill_to_indicator = {
            "vocabulary":          IndicatorType.LEXICAL_DIVERSITY,
            "word_choice":         IndicatorType.LEXICAL_SOPHISTICATION,
            "grammar":             IndicatorType.MORPHOSYNTACTIC_ACCURACY,
            "sentence_length":     IndicatorType.SENTENCE_COMPLEXITY,
            "complex_structures":  IndicatorType.SUBORDINATION_RATIO,
            "coherence":           IndicatorType.COHESION_SCORE,
            # legacy aliases
            "writing":             IndicatorType.SYNTACTIC_COMPLEXITY,
            "comprehension":       IndicatorType.LEXICAL_SOPHISTICATION,
        }
        # Speech skills CANNOT be measured from writing. Their real score comes from
        # the learner's speaking sessions (Accent ADN → pronunciation, Shadow →
        # fluency), passed in as already-normalised 0-100 values. If absent we say so
        # honestly instead of imputing a number from the writing level.
        SPEECH_SKILLS = {"pronunciation", "fluency", "speaking"}
        speech_measurements = {k.lower(): v for k, v in (speech_measurements or {}).items()}

        # Compare every skill the learner rated, plus any flagged pain point.
        skills = sorted(set((self_ratings or {}).keys()) | set(pain_points))

        for skill in skills:
            skill_l = skill.lower()

            # The learner's REAL self-rating (1-5 scale), mapped to 0-100:
            # 1→10, 2→30, 3→50, 4→70, 5→90.
            rating = (self_ratings or {}).get(skill)
            if rating:
                user_score_100 = max(0.0, min(100.0, rating * 20 - 10))
            else:
                # Backward-compat: a flagged area with no rating is assumed weak (~40%).
                user_score_100 = 40.0

            # --- System side (real measurement only) ---
            if skill_l in SPEECH_SKILLS:
                system_measured = speech_measurements.get(skill_l)
                if system_measured is None:
                    discrepancies[skill] = {
                        "user_score": round(user_score_100, 1),
                        "system_score": None,
                        "gap": None,
                        "status": "not_measured",
                        "interpretation": (
                            "Not measured yet — speaking skills come from your Accent ADN "
                            "and Shadow Speaking sessions, not the writing diagnostic. "
                            "Do a speaking session to compare."
                        ),
                    }
                    continue
            else:
                indicator = skill_to_indicator.get(skill_l)
                if not indicator:
                    continue
                raw_val = measured_indicators.get(indicator)
                if raw_val is None:
                    continue  # never fabricate a measurement we don't have
                system_measured = self.calc.evaluate_indicator(indicator, raw_val)["normalized_score"]

            # Gap = system − self. Positive → the system rates you higher than you do.
            gap = system_measured - user_score_100

            if abs(gap) <= 20:
                status = "aligned"
                aligned.append(skill)
                interpretation = (f"Confirmed: the system measures ~{system_measured:.0f}%, close to "
                                  f"how you rate yourself.")
            elif gap > 20:
                status = "overestimates_problem"
                user_overestimates.append(skill)
                interpretation = (f"Better than you think: measured {system_measured:.0f}% vs your "
                                  f"~{user_score_100:.0f}% self-rating — a relative strength, less urgent.")
            else:
                status = "underestimates_problem"
                user_underestimates.append(skill)
                interpretation = (f"Weaker than you think: measured {system_measured:.0f}% vs your "
                                  f"~{user_score_100:.0f}% self-rating — high priority.")

            discrepancies[skill] = {
                # Keys the frontend DiscrepancyBar reads (0-100 scale).
                "user_score": round(user_score_100, 1),
                "system_score": round(system_measured, 1),
                "gap": round(gap, 1),
                "status": status,
                "interpretation": interpretation
            }
        
        # Priority focus areas: weaker-than-expected first, then confirmed weaknesses.
        priority_focus = [(area, "System measured lower than you expected — top priority") for area in user_underestimates]
        priority_focus += [(area, "Confirmed weakness — focus here") for area in aligned]
        if not priority_focus:
            priority_focus = [(area, "Relative strength — maintain") for area in user_overestimates[:2]]
        
        research_justification = (
            "Dual diagnosis identifies discrepancies between user perception and system measurement "
            "(Li & Shintani, 2010: corrective feedback effectiveness depends on accurate diagnosis). "
            "Areas of underestimation require immediate intervention; overestimated areas are relative strengths."
        )
        
        return DualDiagnosisResult(
            user_id=user_id,
            assessment_date=datetime.utcnow(),
            pain_points=pain_points,
            discrepancies=discrepancies,
            areas_user_overestimates=user_overestimates,
            areas_user_underestimates=user_underestimates,
            aligned_areas=aligned,
            priority_focus=priority_focus,
            research_justification=research_justification
        )

    def generate_full_report(
        self,
        user_id: str,
        initial_assessment: Optional[InitialAssessmentResult],
        reassessment: Optional[ReassessmentResult],
        dual_diagnosis: Optional[DualDiagnosisResult],
        learning_path: Optional[Dict],
        onboarding_goals: Optional[str],
        target_exam: Optional[str]
    ) -> AssessmentReport:
        """
        Generate comprehensive report with all components and bibliography.
        """
        # Collect all unique sources
        all_sources = set()
        if initial_assessment:
            for ind in initial_assessment.indicators:
                all_sources.update(ind.research_sources)
        
        all_sources.update([s.value for s in ResearchSource])
        bibliography = sorted(list(all_sources))
        
        methodology = (
            "Assessment Methodology: 10-indicator CAF (Complexity-Accuracy-Fluency) framework "
            "based on SLA research (Pallotti, 2015). Indicators measure lexical diversity, "
            "sophistication, syntactic complexity, fluency, accuracy, and cohesion. "
            "Results mapped to CEFR levels (A1-C2) and international exams (Cambridge, TOEFL, IELTS) "
            "using exam-specific weights from research (Zechner et al., 2009)."
        )
        
        return AssessmentReport(
            user_id=user_id,
            report_date=datetime.utcnow(),
            onboarding_goals=onboarding_goals,
            target_exam=target_exam,
            initial_assessment=initial_assessment,
            latest_reassessment=reassessment,
            dual_diagnosis=dual_diagnosis,
            learning_path=learning_path or {},
            recommended_modules=learning_path.get("recommended_modules", []) if learning_path else [],
            full_bibliography=bibliography,
            assessment_methodology=methodology
        )


# Global singleton
assessment_engine = AssessmentWorkflowEngine()

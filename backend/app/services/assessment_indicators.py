"""
Assessment Indicators Framework - 10 Standardized Metrics for L2 Proficiency

Based on academic research from:
1. Lee (2021) - Genre effects on syntactic complexity & lexical diversity
2. Zechner et al. (2009) - TOEFL iBT Speaking assessment features
3. Ahari et al. (2025) - L2 speaking proficiency assessment model
4. Saito (2012) - Pronunciation instruction meta-analysis
5. Li & Shintani (2010) - Corrective feedback meta-analysis
6. Şahin Kızıl, A. (2024). Linguistic dimensions of L2 performance: Complexity,
   accuracy and fluency. Gaziantep University Journal of Social Sciences, 23(4),
   1736–1740. Comprehensive CAF review validating MTLD as most robust lexical diversity
   index (length-independent) and error-free clause ratio (EFC/C) for accuracy.
7. Neumanová, Z. (2025). An investigation of complexity, accuracy, and fluency in the
   speech of EFL learners. Theory and Practice of Second Language Acquisition, 11(1),
   1–22. Empirically confirms all three CAF dimensions significantly predict oral
   proficiency (A2→B1→B2); IDL (Index of Developmental Levels) and articulation rate
   are the most reliable discriminators between adjacent CEFR levels.

This framework provides measurable, research-backed indicators for evaluating learner proficiency.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional
from datetime import datetime


class IndicatorType(Enum):
    """10 standardized assessment indicators"""
    LEXICAL_DIVERSITY = "lexical_diversity"          # 1
    LEXICAL_SOPHISTICATION = "lexical_sophistication"  # 2
    WORD_LENGTH = "word_length"                      # 3
    SENTENCE_COMPLEXITY = "sentence_complexity"      # 4
    SUBORDINATION_RATIO = "subordination_ratio"      # 5
    SYNTACTIC_COMPLEXITY = "syntactic_complexity"    # 6
    ARTICULATION_RATE = "articulation_rate"          # 7
    PAUSE_FREQUENCY = "pause_frequency"              # 8
    COHESION_SCORE = "cohesion_score"                # 9
    MORPHOSYNTACTIC_ACCURACY = "morphosyntactic_accuracy"  # 10


class ExamType(Enum):
    """International standardized exams - mapping to indicators"""
    CAMBRIDGE_FCE = "cambridge_fce"    # B2
    CAMBRIDGE_CAE = "cambridge_cae"    # C1
    CAMBRIDGE_CPE = "cambridge_cpe"    # C2
    TOEFL_iBT = "toefl_ibt"
    IELTS_GENERAL = "ielts_general"
    IELTS_ACADEMIC = "ielts_academic"
    PTE_CORE = "pte_core"


@dataclass
class IndicatorDefinition:
    """Definition and measurement guidance for each indicator"""
    indicator: IndicatorType
    name: str
    description: str
    measurement_unit: str
    calculation_formula: str
    range_min: float
    range_max: float
    cefr_benchmarks: Dict[str, float]  # A1, A2, B1, B2, C1, C2
    primary_research: List[str]  # Academic sources
    interpretation: str
    automation_possible: bool
    example_value: float


class AssessmentIndicatorsDatabase:
    """
    Complete database of 10 research-backed assessment indicators
    with CEFR benchmarks and international exam mapping
    """

    # Indicator 1: LEXICAL DIVERSITY (Type-Token Ratio, D Index)
    INDICATOR_1 = IndicatorDefinition(
        indicator=IndicatorType.LEXICAL_DIVERSITY,
        name="Lexical Diversity (D Index / VOCD)",
        description="Measure of vocabulary variety - how many different words used relative to total words",
        measurement_unit="Index (0-100+)",
        calculation_formula="VOCD function: type-token ratio averaged over 100 random word samples",
        range_min=20.0,
        range_max=100.0,
        cefr_benchmarks={
            "A1": 25.0,
            "A2": 35.0,
            "B1": 45.0,
            "B2": 60.0,
            "C1": 75.0,
            "C2": 85.0
        },
        primary_research=[
            "Lee (2021) - Genre effects on syntactic complexity in L2 writing (Table 3, 4)",
            "Malvern et al. (2004) - Lexical diversity and writing ability correlation",
            "Kolahi Ahari et al. (2025) - MTLD as strongest L2 proficiency predictor (β=.40)",
            "Yu (2010) - VOCD function application"
        ],
        interpretation="Higher values indicate greater vocabulary variety. Learners who reuse few words appear less advanced.",
        automation_possible=True,
        example_value=62.22  # From Lee 2021 data: advanced learners
    )

    # Indicator 2: LEXICAL SOPHISTICATION (Word Frequency)
    INDICATOR_2 = IndicatorDefinition(
        indicator=IndicatorType.LEXICAL_SOPHISTICATION,
        name="Lexical Sophistication (Word Frequency)",
        description="Measure of word complexity - use of less frequent (more advanced) vocabulary",
        measurement_unit="Logarithmic frequency score",
        calculation_formula="Average logarithm of word frequency (based on 17.9M word CELEX database)",
        range_min=1.0,
        range_max=6.0,
        cefr_benchmarks={
            "A1": 5.8,
            "A2": 5.5,
            "B1": 5.0,
            "B2": 4.5,
            "C1": 4.0,
            "C2": 3.5
        },
        primary_research=[
            "Lee (2021) - Word Frequency (WF) measure (Table 3)",
            "CELEX Lexical Database (Baayen et al., 1995)",
            "Laufer & Nation (1995) - Word frequency proficiency indicator"
        ],
        interpretation="Lower scores = more sophisticated vocabulary. Frequent words (high score) = lower proficiency.",
        automation_possible=True,
        example_value=4.2
    )

    # Indicator 3: WORD LENGTH (Average)
    INDICATOR_3 = IndicatorDefinition(
        indicator=IndicatorType.WORD_LENGTH,
        name="Average Word Length",
        description="Morphological complexity - average length of words used",
        measurement_unit="Number of characters per word",
        calculation_formula="Sum of word character lengths / Total number of words",
        range_min=3.0,
        range_max=6.0,
        cefr_benchmarks={
            "A1": 3.5,
            "A2": 3.8,
            "B1": 4.2,
            "B2": 4.6,
            "C1": 5.0,
            "C2": 5.3
        },
        primary_research=[
            "Lee (2021) - Average Word Length (WL) measure (Table 3)",
            "Malvern et al. (2004) - Word length as proficiency indicator"
        ],
        interpretation="Longer words indicate higher proficiency. Related to word frequency (longer words are rarer).",
        automation_possible=True,
        example_value=4.8
    )

    # Indicator 4: SENTENCE COMPLEXITY (Mean Length of Sentence)
    INDICATOR_4 = IndicatorDefinition(
        indicator=IndicatorType.SENTENCE_COMPLEXITY,
        name="Sentence Complexity (Mean Length of Sentence)",
        description="Structural complexity - average words per sentence",
        measurement_unit="Words per sentence",
        calculation_formula="Total number of words / Number of sentences",
        range_min=5.0,
        range_max=25.0,
        cefr_benchmarks={
            "A1": 7.0,
            "A2": 9.0,
            "B1": 12.0,
            "B2": 15.0,
            "C1": 18.0,
            "C2": 20.0
        },
        primary_research=[
            "Lee (2021) - Mean Length of Sentence (MLS) measure (Table 2)",
            "Lu (2010) - Syntactic complexity analyzer",
            "Barrot & Agdeppa (2021) - MLS among 14 complexity indices across CEFR levels"
        ],
        interpretation="Longer sentences indicate more complex structures. But quality matters: longer ≠ always better.",
        automation_possible=True,
        example_value=14.5
    )

    # Indicator 5: SUBORDINATION RATIO (Dependent Clauses)
    INDICATOR_5 = IndicatorDefinition(
        indicator=IndicatorType.SUBORDINATION_RATIO,
        name="Subordination Ratio (Dependent Clauses per T-unit)",
        description="Structural sophistication - use of dependent clauses for complex ideas",
        measurement_unit="Ratio (0-3.0)",
        calculation_formula="Number of dependent clauses / Number of T-units",
        range_min=0.0,
        range_max=3.0,
        cefr_benchmarks={
            "A1": 0.3,
            "A2": 0.5,
            "B1": 0.8,
            "B2": 1.2,
            "C1": 1.6,
            "C2": 2.0
        },
        primary_research=[
            "Lee (2021) - Dependent Clause Ratio (DC/C) (Table 2)",
            "Lu (2010) - T-unit complexity measurement",
            "Bardovi-Harlig (1992) - Clause complexity and proficiency"
        ],
        interpretation="Higher ratios = more subordination = higher proficiency. Key marker of advanced syntax.",
        automation_possible=True,
        example_value=1.4
    )

    # Indicator 6: SYNTACTIC COMPLEXITY (Clauses per Sentence)
    INDICATOR_6 = IndicatorDefinition(
        indicator=IndicatorType.SYNTACTIC_COMPLEXITY,
        name="Syntactic Complexity (Clauses per Sentence)",
        description="Structural richness - number of clauses combined in single sentences",
        measurement_unit="Clauses per sentence",
        calculation_formula="Total number of clauses / Number of sentences",
        range_min=1.0,
        range_max=4.0,
        cefr_benchmarks={
            "A1": 1.1,
            "A2": 1.3,
            "B1": 1.6,
            "B2": 2.0,
            "C1": 2.4,
            "C2": 2.8
        },
        primary_research=[
            "Lee (2021) - Clauses per Sentence (C/S) (Table 2)",
            "Ahari et al. (2025) - Syntactic complexity in speaking proficiency (explains 34% variance)",
            "Lu & Cumming (2011) - Syntactic complexity measurement"
        ],
        interpretation="Higher ratios indicate ability to pack multiple ideas into integrated structures.",
        automation_possible=True,
        example_value=2.1
    )

    # Indicator 7: ARTICULATION RATE (Words per Second)
    INDICATOR_7 = IndicatorDefinition(
        indicator=IndicatorType.ARTICULATION_RATE,
        name="Articulation Rate (Words per Second)",
        description="Speech clarity - speed of clear speech (excluding pauses)",
        measurement_unit="Words per second",
        calculation_formula="Number of words / Duration of speech (excluding pauses/disfluencies)",
        range_min=1.0,
        range_max=4.5,
        cefr_benchmarks={
            "A1": 1.2,
            "A2": 1.5,
            "B1": 2.0,
            "B2": 2.5,
            "C1": 3.0,
            "C2": 3.5
        },
        primary_research=[
            "Zechner et al. (2009) - TOEFL iBT Speaking features (wpsec in Table 6, selected feature #8)",
            "Cucchiarini et al. (2000) - Pronunciation assessment metrics"
        ],
        interpretation="Higher rates = clearer speech. Native speakers ~2.5-3.5 wps. Very high may = unclear.",
        automation_possible=True,
        example_value=2.8
    )

    # Indicator 8: PAUSE FREQUENCY (Disfluencies)
    INDICATOR_8 = IndicatorDefinition(
        indicator=IndicatorType.PAUSE_FREQUENCY,
        name="Pause/Disfluency Rate (Duration of Silences per Word)",
        description="Fluency - frequency and length of hesitations, silent pauses, filled pauses",
        measurement_unit="Seconds per word",
        calculation_formula="Total pause duration / Number of words",
        range_min=0.0,
        range_max=1.0,
        cefr_benchmarks={
            "A1": 0.8,
            "A2": 0.6,
            "B1": 0.4,
            "B2": 0.25,
            "C1": 0.15,
            "C2": 0.10
        },
        primary_research=[
            "Zechner et al. (2009) - TOEFL iBT fluency features (silpwd in Table 6, selected feature #13)",
            "Zechner et al. (2009) - Mean silence duration (silmean, selected feature #15)",
            "Cucchiarini et al. (2000) - Pause analysis in non-native speech",
            "Skehan & Foster (2001) - Fluency and planning time effects"
        ],
        interpretation="Lower values = better fluency. High pauses indicate cognitive processing load or anxiety.",
        automation_possible=True,
        example_value=0.32
    )

    # Indicator 9: COHESION SCORE (Discourse Coherence)
    INDICATOR_9 = IndicatorDefinition(
        indicator=IndicatorType.COHESION_SCORE,
        name="Cohesion & Coherence (Discourse Markers, Text Cohesion)",
        description="Discourse organization - use of connectors, transitions, clear idea relationships",
        measurement_unit="Score (0-100)",
        calculation_formula="Analysis of discourse markers, anaphora, lexical chains, connective words per 100 words",
        range_min=0.0,
        range_max=100.0,
        cefr_benchmarks={
            "A1": 20.0,
            "A2": 35.0,
            "B1": 50.0,
            "B2": 65.0,
            "C1": 78.0,
            "C2": 88.0
        },
        primary_research=[
            "Ahari et al. (2025) - Cohesion as key L2 speaking proficiency indicator (explains 34% variance)",
            "Crossley & McNamara (2016) - TAACO tool for text cohesion analysis",
            "Graesser et al. (2004) - Coh-Metrix tool for cohesion measurement",
            "Brown & Yule (1983) - Discourse analysis frameworks"
        ],
        interpretation="High cohesion = ideas clearly connected. Low = ideas appear isolated or rambling.",
        automation_possible=True,
        example_value=72.0
    )

    # Indicator 10: MORPHOSYNTACTIC ACCURACY (Grammar Correctness)
    INDICATOR_10 = IndicatorDefinition(
        indicator=IndicatorType.MORPHOSYNTACTIC_ACCURACY,
        name="Morphosyntactic Accuracy (Grammar & Tense Accuracy)",
        description="Grammatical correctness - percentage of error-free clauses, agreement, tense/aspect",
        measurement_unit="Percentage (0-100%)",
        calculation_formula="Number of error-free clauses / Total number of clauses × 100",
        range_min=0.0,
        range_max=100.0,
        cefr_benchmarks={
            "A1": 30.0,
            "A2": 45.0,
            "B1": 60.0,
            "B2": 75.0,
            "C1": 85.0,
            "C2": 92.0
        },
        primary_research=[
            "Zechner et al. (2009) - TOEFL iBT language model score (lmscore in Table 6, selected feature #29)",
            "Li & Shintani (2010) - Corrective feedback meta-analysis (d=0.48 effect on accuracy)",
            "Saito (2012) - Pronunciation & grammar co-development"
        ],
        interpretation="Higher % = better grammar control. Improvement indicator post-intervention.",
        automation_possible=True,
        example_value=78.5
    )

    # Complete indicator database
    INDICATORS = [
        INDICATOR_1,  # Lexical Diversity
        INDICATOR_2,  # Lexical Sophistication
        INDICATOR_3,  # Word Length
        INDICATOR_4,  # Sentence Complexity
        INDICATOR_5,  # Subordination
        INDICATOR_6,  # Syntactic Complexity
        INDICATOR_7,  # Articulation Rate
        INDICATOR_8,  # Pause Frequency
        INDICATOR_9,  # Cohesion
        INDICATOR_10  # Morphosyntactic Accuracy
    ]

    # Exam-specific indicator weights
    EXAM_WEIGHTS = {
        ExamType.CAMBRIDGE_FCE: {
            IndicatorType.LEXICAL_DIVERSITY: 0.15,
            IndicatorType.LEXICAL_SOPHISTICATION: 0.15,
            IndicatorType.SENTENCE_COMPLEXITY: 0.12,
            IndicatorType.SUBORDINATION_RATIO: 0.12,
            IndicatorType.SYNTACTIC_COMPLEXITY: 0.10,
            IndicatorType.ARTICULATION_RATE: 0.08,
            IndicatorType.PAUSE_FREQUENCY: 0.08,
            IndicatorType.COHESION_SCORE: 0.12,
            IndicatorType.MORPHOSYNTACTIC_ACCURACY: 0.08,
            IndicatorType.WORD_LENGTH: 0.00
        },
        ExamType.CAMBRIDGE_CAE: {
            IndicatorType.LEXICAL_DIVERSITY: 0.12,
            IndicatorType.LEXICAL_SOPHISTICATION: 0.18,
            IndicatorType.SENTENCE_COMPLEXITY: 0.10,
            IndicatorType.SUBORDINATION_RATIO: 0.14,
            IndicatorType.SYNTACTIC_COMPLEXITY: 0.12,
            IndicatorType.ARTICULATION_RATE: 0.07,
            IndicatorType.PAUSE_FREQUENCY: 0.07,
            IndicatorType.COHESION_SCORE: 0.15,
            IndicatorType.MORPHOSYNTACTIC_ACCURACY: 0.05,
            IndicatorType.WORD_LENGTH: 0.00
        },
        ExamType.TOEFL_iBT: {
            IndicatorType.ARTICULATION_RATE: 0.15,
            IndicatorType.PAUSE_FREQUENCY: 0.15,
            IndicatorType.MORPHOSYNTACTIC_ACCURACY: 0.20,
            IndicatorType.LEXICAL_DIVERSITY: 0.12,
            IndicatorType.LEXICAL_SOPHISTICATION: 0.12,
            IndicatorType.COHESION_SCORE: 0.13,
            IndicatorType.SENTENCE_COMPLEXITY: 0.08,
            IndicatorType.SUBORDINATION_RATIO: 0.05,
            IndicatorType.SYNTACTIC_COMPLEXITY: 0.00,
            IndicatorType.WORD_LENGTH: 0.00
        },
        ExamType.IELTS_ACADEMIC: {
            IndicatorType.LEXICAL_DIVERSITY: 0.15,
            IndicatorType.LEXICAL_SOPHISTICATION: 0.15,
            IndicatorType.SENTENCE_COMPLEXITY: 0.10,
            IndicatorType.SUBORDINATION_RATIO: 0.10,
            IndicatorType.SYNTACTIC_COMPLEXITY: 0.08,
            IndicatorType.ARTICULATION_RATE: 0.10,
            IndicatorType.PAUSE_FREQUENCY: 0.10,
            IndicatorType.COHESION_SCORE: 0.15,
            IndicatorType.MORPHOSYNTACTIC_ACCURACY: 0.07,
            IndicatorType.WORD_LENGTH: 0.00
        }
    }


@dataclass
class UserAssessmentResult:
    """User proficiency assessment result"""
    learner_id: str
    assessment_date: datetime
    domain: str
    indicators: Dict[str, float]  # {IndicatorType.name: score}
    overall_score: float  # 0-100
    cefr_level: str  # A1-C2
    exam_type: Optional[ExamType] = None
    exam_adjusted_score: Optional[float] = None
    recommendations: List[str] = None


@dataclass
class DualDiagnosis:
    """Comparison between user perception and system assessment"""
    learner_id: str
    user_perception: Dict[str, int]  # What user says they need (1-10 scale)
    system_diagnosis: Dict[str, float]  # What system measured (0-100)
    discrepancy_analysis: Dict[str, str]  # Explanation of differences
    recommendations: List[str]
    priority_focus_areas: List[tuple]  # [(area, reason)]


class AssessmentIndicatorsCalculator:
    """
    Calculate and manage the 10 assessment indicators
    """

    def __init__(self):
        self.indicators_db = AssessmentIndicatorsDatabase()

    def get_indicator(self, indicator_type: IndicatorType) -> IndicatorDefinition:
        """Get definition of specific indicator"""
        for ind in self.indicators_db.INDICATORS:
            if ind.indicator == indicator_type:
                return ind
        raise ValueError(f"Indicator {indicator_type} not found")

    def get_all_indicators(self) -> List[IndicatorDefinition]:
        """Get all 10 indicators with full definitions"""
        return self.indicators_db.INDICATORS

    def evaluate_indicator(
        self,
        indicator_type: IndicatorType,
        measured_value: float
    ) -> Dict:
        """
        Evaluate a single indicator measurement
        Returns: score (0-100), cefr_level, interpretation
        """
        ind = self.get_indicator(indicator_type)
        
        # Normalize value to 0-100 scale
        if ind.range_max != ind.range_min:
            normalized_score = ((measured_value - ind.range_min) / 
                              (ind.range_max - ind.range_min)) * 100
        else:
            normalized_score = measured_value
        
        normalized_score = max(0, min(100, normalized_score))
        
        # Determine CEFR level
        cefr_level = self._determine_cefr_from_benchmark(ind, measured_value)
        
        return {
            "indicator": indicator_type.value,
            "measured_value": measured_value,
            "normalized_score": normalized_score,
            "range": f"{ind.range_min} - {ind.range_max} {ind.measurement_unit}",
            "cefr_level": cefr_level,
            "interpretation": ind.interpretation,
            "benchmark": ind.cefr_benchmarks.get(cefr_level)
        }

    def _determine_cefr_from_benchmark(self, indicator: IndicatorDefinition, value: float) -> str:
        """Determine CEFR level from measured value"""
        benchmarks = indicator.cefr_benchmarks
        cefr_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
        
        for i, level in enumerate(cefr_levels):
            if value < benchmarks[level]:
                return cefr_levels[max(0, i-1)]
        return "C2"

    def calculate_overall_score(
        self,
        indicator_scores: Dict[IndicatorType, float],
        exam_type: Optional[ExamType] = None
    ) -> float:
        """
        Calculate overall proficiency score
        With optional exam-specific weighting
        """
        if exam_type and exam_type in self.indicators_db.EXAM_WEIGHTS:
            weights = self.indicators_db.EXAM_WEIGHTS[exam_type]
            total_weight = 0
            weighted_sum = 0
            
            for indicator_type, value in indicator_scores.items():
                weight = weights.get(indicator_type, 0)
                if weight > 0:
                    weighted_sum += value * weight
                    total_weight += weight
            
            return weighted_sum / total_weight if total_weight > 0 else 0
        else:
            # Equal weights if no exam specified
            return sum(indicator_scores.values()) / len(indicator_scores) if indicator_scores else 0

    def create_dual_diagnosis(
        self,
        learner_id: str,
        user_perception: Dict[str, int],  # 1-10 scale
        measured_indicators: Dict[IndicatorType, float]
    ) -> DualDiagnosis:
        """
        Create diagnostic comparison between user perception and system measurement
        """
        system_diagnosis = {}
        discrepancy_analysis = {}
        recommendations = []
        priority_areas = []
        
        # Areas user mentioned
        perception_areas = list(user_perception.keys())
        
        for area in perception_areas:
            user_score = user_perception[area] * 10  # Convert to 0-100
            
            # Find corresponding indicator
            matching_indicator = self._match_perception_to_indicator(area)
            if matching_indicator:
                system_score = measured_indicators.get(matching_indicator, 50)
                system_diagnosis[area] = system_score
                
                # Analyze discrepancy
                gap = user_score - system_score
                if abs(gap) > 20:
                    if gap > 0:
                        discrepancy_analysis[area] = (
                            f"User overestimates {area}: "
                            f"Self-assessment {user_score}% vs. System measured {system_score}%"
                        )
                        recommendations.append(
                            f"Focus on {area} - system detected it as lower priority than you perceive"
                        )
                        priority_areas.append((area, "Lower than perceived"))
                    else:
                        discrepancy_analysis[area] = (
                            f"User underestimates {area}: "
                            f"Self-assessment {user_score}% vs. System measured {system_score}%"
                        )
                        recommendations.append(
                            f"{area.title()} is stronger than you think - leverage this strength"
                        )
                        priority_areas.append((area, "Higher than perceived"))
                else:
                    discrepancy_analysis[area] = (
                        f"Self-assessment aligned with measurement: {user_score:.0f}% (±20%)"
                    )
        
        return DualDiagnosis(
            learner_id=learner_id,
            user_perception=user_perception,
            system_diagnosis=system_diagnosis,
            discrepancy_analysis=discrepancy_analysis,
            recommendations=recommendations,
            priority_focus_areas=priority_areas
        )

    def _match_perception_to_indicator(self, perception_area: str) -> Optional[IndicatorType]:
        """Map user perception areas to indicators"""
        mapping = {
            "vocabulary": IndicatorType.LEXICAL_DIVERSITY,
            "pronunciation": IndicatorType.ARTICULATION_RATE,
            "grammar": IndicatorType.MORPHOSYNTACTIC_ACCURACY,
            "fluency": IndicatorType.PAUSE_FREQUENCY,
            "speaking": IndicatorType.ARTICULATION_RATE,
            "writing": IndicatorType.SYNTACTIC_COMPLEXITY,
            "comprehension": IndicatorType.LEXICAL_SOPHISTICATION,
        }
        return mapping.get(perception_area.lower())


# Global singleton instance
assessment_calculator = AssessmentIndicatorsCalculator()

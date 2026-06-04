"""
Module Recommendation Algorithm
Converts 10 indicator scores → prioritized learning module sequence
Based on: MODULE_RECOMMENDATION_ALGORITHM.md + Shabani & Panahi (2020)

Input: Assessment results (10 indicators) + learner CEFR level + target test
Output: Ranked module recommendations with severity scores and time estimates
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple
from enum import Enum
import json


class CEFRLevel(Enum):
    """CEFR proficiency levels"""
    A2 = 1
    B1 = 2
    B2 = 3
    C1 = 4
    C2 = 5


class TargetTest(Enum):
    """Standardized tests"""
    IELTS = "IELTS"
    TOEFL = "TOEFL"
    CAMBRIDGE = "CAMBRIDGE"
    GENERAL = "GENERAL"


class Module(Enum):
    """Available learning modules"""
    VOCABULARY_COACH = "Vocabulary Coach"
    GRAMMAR = "Grammar Module"
    ACCENT = "Accent Module"
    FLUENCY = "Fluency Module"
    DISCOURSE = "Discourse Module"
    CONVERSATION = "Conversation Module"
    SHADOW_SPEAKING = "Shadow Speaking"
    SRS = "SRS Module"


@dataclass
class AssessmentIndicators:
    """10 indicators from assessment"""
    mtld: float  # Lexical diversity (Measure of Textual Lexical Diversity)
    awl_percent: float  # Academic Word List coverage %
    mls: float  # Mean Length of Sentence
    mlt: float  # Mean Length of T-unit
    mlc: float  # Mean Length of Clause
    wcr: float  # Word-level Correct Ratio (grammatical accuracy)
    pronunciation: float  # Pronunciation intelligibility %
    fluency_wpm: float  # Words per minute
    micro_fluency: float  # Pause ratio / disfluency score
    coherence: float  # LSA (Latent Semantic Analysis) coherence score
    
    def to_dict(self) -> Dict[str, float]:
        return {
            'MTLD': self.mtld,
            'AWL%': self.awl_percent,
            'MLS': self.mls,
            'MLT': self.mlt,
            'MLC': self.mlc,
            'WCR': self.wcr,
            'Pronunciation': self.pronunciation,
            'Fluency': self.fluency_wpm,
            'MicroFluency': self.micro_fluency,
            'Coherence': self.coherence
        }


@dataclass
class CriticalGap:
    """Identified gap in learner's profile"""
    indicator: str
    learner_score: float
    cefr_threshold: float
    severity: float  # 0.0-1.0 (1.0 = critical)
    
    def __repr__(self) -> str:
        return f"{self.indicator}: {self.learner_score:.2f} (target: {self.cefr_threshold:.2f}, severity: {self.severity:.2f})"


@dataclass
class ModuleRecommendation:
    """Single module recommendation"""
    module: Module
    priority_rank: int  # 1=highest priority
    severity_score: float  # 0.0-1.0
    time_estimate_hours: float  # Estimated hours to complete
    target_indicators: List[str]  # Indicators this module targets
    test_alignment: Dict[TargetTest, float]  # Weighting by test (IELTS 0.2, TOEFL 0.15, etc)
    expected_improvement: Dict[str, str]  # {"MTLD": "0.40 → 0.50"}
    
    def __repr__(self) -> str:
        return f"#{self.priority_rank}: {self.module.value} (Severity: {self.severity_score:.2%}, {self.time_estimate_hours:.0f}h)"


class CEFRThresholds:
    """CEFR thresholds for each indicator (from Barrot 2021 ICNALE analysis)"""
    
    THRESHOLDS = {
        CEFRLevel.A2: {
            'MTLD': 0.35,
            'AWL%': 0.05,
            'MLS': 15.18,
            'MLT': 13.69,
            'MLC': 8.39,
            'WCR': 0.84,
            'Pronunciation': 0.60,
            'Fluency': 140.0,  # WPM
            'MicroFluency': 0.4,  # Pause ratio
            'Coherence': 0.30,
        },
        CEFRLevel.B1: {
            'MTLD': 0.50,
            'AWL%': 0.10,
            'MLS': 16.5,
            'MLT': 14.8,
            'MLC': 8.75,
            'WCR': 0.87,
            'Pronunciation': 0.75,
            'Fluency': 155.0,
            'MicroFluency': 0.25,
            'Coherence': 0.50,
        },
        CEFRLevel.B2: {
            'MTLD': 0.65,
            'AWL%': 0.20,
            'MLS': 18.5,
            'MLT': 16.5,
            'MLC': 9.5,
            'WCR': 0.92,
            'Pronunciation': 0.85,
            'Fluency': 170.0,
            'MicroFluency': 0.15,
            'Coherence': 0.70,
        },
        CEFRLevel.C1: {
            'MTLD': 0.80,
            'AWL%': 0.30,
            'MLS': 20.0,
            'MLT': 18.0,
            'MLC': 10.0,
            'WCR': 0.96,
            'Pronunciation': 0.90,
            'Fluency': 180.0,
            'MicroFluency': 0.05,
            'Coherence': 0.85,
        },
    }
    
    @classmethod
    def get(cls, level: CEFRLevel, indicator: str) -> float:
        """Get CEFR threshold for indicator at given level"""
        return cls.THRESHOLDS.get(level, {}).get(indicator, 0.0)


class TestWeights:
    """Test-specific indicator weighting (from Shabani & Panahi 2020)"""
    
    WEIGHTS = {
        TargetTest.IELTS: {
            'MTLD': 0.25,      # Lexical Range
            'Coherence': 0.25, # Coherence & Cohesion
            'WCR': 0.25,       # Grammatical Range
            'MLS': 0.10,       # Organization
            'Pronunciation': 0.10,
        },
        TargetTest.TOEFL: {
            'WCR': 0.25,       # Language Use
            'Coherence': 0.25, # Organization
            'MTLD': 0.15,      # Vocabulary
            'Fluency': 0.20,   # Delivery (speaking)
            'Pronunciation': 0.15,
        },
        TargetTest.CAMBRIDGE: {
            'WCR': 0.30,       # Language/Grammar
            'MTLD': 0.25,      # Content + Vocabulary
            'Coherence': 0.25, # Organization
            'MLS': 0.10,       # Register/style (structure)
            'Pronunciation': 0.10,
        },
        TargetTest.GENERAL: {
            'MTLD': 0.20,
            'WCR': 0.20,
            'Coherence': 0.20,
            'Pronunciation': 0.15,
            'Fluency': 0.15,
            'MLS': 0.10,
        },
    }
    
    @classmethod
    def get(cls, test: TargetTest, indicator: str) -> float:
        """Get test-specific weight for indicator"""
        return cls.WEIGHTS.get(test, {}).get(indicator, 0.0)


class DomainWeights:
    """
    COCA genre-specific indicator weighting.

    Each genre foregrounds different CAF dimensions:
      Source: Tauroza & Allison (1990) register variation; Pallotti (2009) CAF framework;
              Davies (COCA) — genre frequency profiles.
    """

    WEIGHTS = {
        # ── Spoken (TV/radio, interviews, talk shows) ─────────────────────────
        # Real-time interaction: fluency and pronunciation are critical.
        "spoken": {
            'Fluency':      0.30,   # WPM — natural conversational pace
            'Pronunciation':0.25,   # Clear articulation for comprehension
            'MicroFluency': 0.20,   # Minimal pauses, smooth turn-taking
            'Coherence':    0.15,   # Relevant, connected responses
            'WCR':          0.10,   # Grammatical accuracy in live speech
        },
        # ── Fiction (novels, screenplays, juvenile fiction) ───────────────────
        # Narrative language: fluency, coherence, and verb-tense control.
        "fiction": {
            'Fluency':      0.25,   # Natural narrative flow
            'Coherence':    0.25,   # Logical sequence of events
            'MLS':          0.15,   # Varied sentence structure
            'WCR':          0.20,   # Accurate past-tense and aspect
            'MicroFluency': 0.10,   # Smooth delivery
            'Pronunciation':0.05,
        },
        # ── Academic (scholarly journals, science, law, medicine) ─────────────
        # Formal precision: syntactic complexity, academic vocabulary, accuracy.
        "academic": {
            'WCR':          0.25,   # Syntactic accuracy and complexity
            'MTLD':         0.25,   # Sophisticated vocabulary range
            'Coherence':    0.20,   # Logical argumentation
            'AWL%':         0.15,   # Academic Word List coverage
            'MLS':          0.10,   # Complex sentence structures
            'Pronunciation':0.05,
        },
        # ── Newspaper (national/local news, editorial, opinion) ───────────────
        # Argumentative precision: coherence and AWL% are primary.
        "newspaper": {
            'Coherence':    0.30,   # Logical flow of argument/news structure
            'MTLD':         0.25,   # Precise word choice
            'WCR':          0.20,   # Accurate grammar for credibility
            'AWL%':         0.15,   # News/editorial register vocabulary
            'MLS':          0.10,   # Varied sentence structures
        },
        # ── Magazine (lifestyle, sports, science, religion) ───────────────────
        # Descriptive richness: lexical diversity, vivid detail, moderate formality.
        "magazine": {
            'MTLD':         0.25,   # Rich lexical diversity
            'AWL%':         0.20,   # Feature-article register
            'Coherence':    0.20,   # Engaging, organized description
            'WCR':          0.15,   # Correct adjective/preposition use
            'MLS':          0.10,   # Balanced sentence length
            'Pronunciation':0.10,
        },
        # ── Web (informational sites, reviews, instructional) ─────────────────
        # Clarity over formality: coherence and accuracy weighted equally.
        "web": {
            'Coherence':    0.25,   # Clear, scannable structure
            'WCR':          0.25,   # Accurate, unambiguous phrasing
            'MTLD':         0.20,   # Adequate vocabulary range
            'MLS':          0.15,   # Appropriately concise sentences
            'AWL%':         0.10,   # Semi-formal register
            'Pronunciation':0.05,
        },
        # ── Blog (personal, argumentative, promotional) ───────────────────────
        # Informal fluency: natural voice, coherent personal opinion.
        "blog": {
            'Fluency':      0.25,   # Readable, natural pace
            'Coherence':    0.25,   # Opinion structured clearly
            'MTLD':         0.20,   # Varied personal vocabulary
            'WCR':          0.15,   # Grammatical enough for credibility
            'MicroFluency': 0.10,   # Smooth delivery if spoken
            'Pronunciation':0.05,
        },
        # ── Movies (dialogue: action, drama, comedy, sci-fi) ─────────────────
        # Expressive delivery: pronunciation, micro-fluency, natural speech.
        "movies": {
            'Pronunciation':0.30,   # Expressive, clear delivery
            'Fluency':      0.25,   # Dramatic pace and timing
            'MicroFluency': 0.20,   # No disruptive hesitations
            'Coherence':    0.15,   # Scene-appropriate language
            'WCR':          0.10,   # Grammatical enough for characterisation
        },
        # ── TV Shows (drama, comedy, reality, crime) ──────────────────────────
        # Similar to movies; slightly more coherence for multi-episode dialogue.
        "tv": {
            'Pronunciation':0.25,
            'Fluency':      0.25,
            'MicroFluency': 0.20,
            'Coherence':    0.20,
            'WCR':          0.10,
        },
    }

    @classmethod
    def get(cls, domain: str, indicator: str) -> float:
        """Get COCA-genre-specific weight for indicator. Falls back to 'spoken'."""
        weights = cls.WEIGHTS.get(domain, cls.WEIGHTS["spoken"])
        return weights.get(indicator, 0.0)


class ModuleIndicatorMap:
    """Maps modules to indicators they target"""
    
    MAP = {
        Module.VOCABULARY_COACH: ['MTLD', 'AWL%', 'Coherence'],
        Module.GRAMMAR: ['WCR', 'MLS', 'MLT', 'MLC'],
        Module.ACCENT: ['Pronunciation', 'MicroFluency'],
        Module.FLUENCY: ['Fluency', 'MicroFluency'],
        Module.DISCOURSE: ['Coherence', 'MLS', 'MLT'],
        Module.CONVERSATION: ['Pronunciation', 'Fluency', 'Coherence'],
        Module.SHADOW_SPEAKING: ['Fluency', 'WCR', 'Pronunciation', 'MLS'],
        Module.SRS: ['MTLD', 'AWL%'],
    }
    
    @classmethod
    def modules_for_indicator(cls, indicator: str) -> List[Module]:
        """Get all modules targeting an indicator"""
        return [m for m, indicators in cls.MAP.items() if indicator in indicators]


class ModuleRecommender:
    """Main algorithm: Convert indicators → module recommendations"""
    
    def __init__(self, cefr_level: CEFRLevel, target_test: TargetTest = TargetTest.GENERAL, domain: str = "spoken"):
        self.cefr_level = cefr_level
        self.target_test = target_test
        self.domain = domain  # NEW: domain type for indicator weighting
    
    def identify_critical_gaps(self, indicators: AssessmentIndicators) -> List[CriticalGap]:
        """
        Step 1: Identify indicators below CEFR threshold
        Returns: Sorted by severity (highest first)
        """
        gaps = []
        indicator_dict = indicators.to_dict()
        
        for indicator_name, learner_score in indicator_dict.items():
            threshold = CEFRThresholds.get(self.cefr_level, indicator_name)
            
            if learner_score < threshold:
                # Calculate severity: (threshold - score) / threshold
                severity = (threshold - learner_score) / threshold if threshold > 0 else 0
                severity = min(1.0, max(0.0, severity))  # Clamp to 0.0-1.0
                
                gaps.append(CriticalGap(
                    indicator=indicator_name,
                    learner_score=learner_score,
                    cefr_threshold=threshold,
                    severity=severity
                ))
        
        # Sort by severity (highest first)
        gaps.sort(key=lambda x: x.severity, reverse=True)
        return gaps
    
    def calculate_module_scores(self, gaps: List[CriticalGap]) -> Dict[Module, float]:
        """
        Step 2: Calculate priority score for each module
        Based on: gap severity + test-specific weighting + domain-specific weighting
        """
        module_scores = {module: 0.0 for module in Module}
        
        # Add base contribution from gap severity
        for gap in gaps:
            target_modules = ModuleIndicatorMap.modules_for_indicator(gap.indicator)
            for module in target_modules:
                module_scores[module] += gap.severity
        
        # Apply test-specific AND domain-specific weighting boost
        for module in module_scores:
            module_boost = 0.0
            target_indicators = ModuleIndicatorMap.MAP[module]
            for indicator in target_indicators:
                # Get both test and domain weights
                test_weight = TestWeights.get(self.target_test, indicator)
                domain_weight = DomainWeights.get(self.domain, indicator)
                
                # Combine weights: test (40%) + domain (60%)
                combined_weight = (test_weight * 0.4) + (domain_weight * 0.6)
                module_boost += combined_weight
            
            # Increase score for test-relevant AND domain-relevant modules
            module_scores[module] *= (1.0 + module_boost)
        
        return module_scores
    
    def apply_override_rules(self, indicators: AssessmentIndicators, module_scores: Dict[Module, float]) -> Dict[Module, float]:
        """
        Step 3: Apply special override rules
        - If Pronunciation < 50% → add Accent module immediately
        - If Fluency < 130 WPM → prioritize Fluency module
        - If Coherence < 0.3 → do Discourse first
        """
        
        # Rule 1: Critical pronunciation issue
        if indicators.pronunciation < 0.50:
            module_scores[Module.ACCENT] = max(module_scores[Module.ACCENT], 1.5)
        
        # Rule 2: Too slow speech
        if indicators.fluency_wpm < 130:
            module_scores[Module.FLUENCY] = max(module_scores[Module.FLUENCY], 1.5)
            module_scores[Module.SHADOW_SPEAKING] = max(module_scores[Module.SHADOW_SPEAKING], 1.0)
        
        # Rule 3: Poor coherence
        if indicators.coherence < 0.30:
            module_scores[Module.DISCOURSE] = max(module_scores[Module.DISCOURSE], 1.5)
        
        # Rule 4: Speaking task → activate conversation modules
        # (Assumes we can detect if test includes speaking)
        if self.target_test in [TargetTest.IELTS, TargetTest.CAMBRIDGE]:
            module_scores[Module.CONVERSATION] = max(module_scores[Module.CONVERSATION], 1.0)
            module_scores[Module.ACCENT] = max(module_scores[Module.ACCENT], 1.0)
        
        return module_scores
    
    def get_time_estimates(self, module: Module) -> float:
        """Return estimated hours to complete module"""
        estimates = {
            Module.VOCABULARY_COACH: 8.0,
            Module.GRAMMAR: 10.0,
            Module.ACCENT: 6.0,
            Module.FLUENCY: 6.0,
            Module.DISCOURSE: 8.0,
            Module.CONVERSATION: 12.0,
            Module.SHADOW_SPEAKING: 10.0,
            Module.SRS: 4.0,
        }
        return estimates.get(module, 8.0)
    
    def get_expected_improvements(self, module: Module, gaps: List[CriticalGap]) -> Dict[str, str]:
        """Return expected score improvements for module"""
        
        # Estimate improvements based on target indicators
        improvements = {}
        target_indicators = ModuleIndicatorMap.MAP[module]
        
        for gap in gaps:
            if gap.indicator in target_indicators:
                # Simple model: Can improve ~30% of the gap
                improvement_amount = gap.cefr_threshold - gap.learner_score
                new_score = gap.learner_score + (improvement_amount * 0.3)
                
                improvements[gap.indicator] = f"{gap.learner_score:.2f} → {new_score:.2f}"
        
        return improvements
    
    def recommend(self, indicators: AssessmentIndicators, limit: int = 3) -> List[ModuleRecommendation]:
        """
        Generate module recommendations
        
        Args:
            indicators: AssessmentIndicators object with 10 scores
            limit: Return top N modules (default 3)
        
        Returns:
            Sorted list of ModuleRecommendation objects
        """
        
        # Step 1: Identify critical gaps
        gaps = self.identify_critical_gaps(indicators)
        
        if not gaps:
            # No gaps found - all indicators above threshold
            return [ModuleRecommendation(
                module=Module.SRS,
                priority_rank=1,
                severity_score=0.1,
                time_estimate_hours=2.0,
                target_indicators=['MTLD', 'AWL%'],
                test_alignment={self.target_test: 0.2},
                expected_improvement={'MTLD': 'Maintenance', 'AWL%': 'Maintenance'}
            )]
        
        # Step 2: Calculate module scores
        module_scores = self.calculate_module_scores(gaps)
        
        # Step 3: Apply override rules
        module_scores = self.apply_override_rules(indicators, module_scores)
        
        # Step 4: Sort by score
        sorted_modules = sorted(module_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Step 5: Create recommendation objects for top N
        recommendations = []
        for rank, (module, score) in enumerate(sorted_modules[:limit], 1):
            target_indicators = ModuleIndicatorMap.MAP[module]
            time_estimate = self.get_time_estimates(module)
            improvements = self.get_expected_improvements(module, gaps)
            
            recommendations.append(ModuleRecommendation(
                module=module,
                priority_rank=rank,
                severity_score=score / (max(module_scores.values()) + 1e-6),  # Normalize to 0-1
                time_estimate_hours=time_estimate,
                target_indicators=target_indicators,
                test_alignment={self.target_test: TestWeights.get(self.target_test, target_indicators[0])},
                expected_improvement=improvements
            ))
        
        return recommendations


def generate_recommendation_report(
    indicators: AssessmentIndicators,
    cefr_level: CEFRLevel,
    target_test: TargetTest = TargetTest.GENERAL,
    limit: int = 3
) -> Dict:
    """
    Convenience function: Generate full recommendation report
    
    Returns: Dictionary with gaps, recommendations, and summary
    """
    
    recommender = ModuleRecommender(cefr_level, target_test)
    gaps = recommender.identify_critical_gaps(indicators)
    recommendations = recommender.recommend(indicators, limit)
    
    return {
        'cefr_level': cefr_level.name,
        'target_test': target_test.value,
        'critical_gaps': [
            {
                'indicator': g.indicator,
                'learner_score': round(g.learner_score, 2),
                'threshold': round(g.cefr_threshold, 2),
                'severity': round(g.severity, 2),
            }
            for g in gaps
        ],
        'recommendations': [
            {
                'rank': r.priority_rank,
                'module': r.module.value,
                'severity': round(r.severity_score, 2),
                'time_hours': round(r.time_estimate_hours, 1),
                'targets': r.target_indicators,
                'improvements': r.expected_improvement,
            }
            for r in recommendations
        ],
        'total_estimated_time': sum(r.time_estimate_hours for r in recommendations),
    }


# Example usage
if __name__ == "__main__":
    # Create sample assessment indicators
    sample_indicators = AssessmentIndicators(
        mtld=0.40,           # Below B1 threshold (0.50)
        awl_percent=0.08,    # Below B1 threshold (0.10)
        mls=15.5,            # Below B1 threshold (16.5)
        mlt=14.2,            # Below B1 threshold (14.8)
        mlc=8.6,             # Below B1 threshold (8.75)
        wcr=0.45,            # CRITICAL: Below B1 threshold (0.87)
        pronunciation=0.68,  # Below B1 threshold (0.75)
        fluency_wpm=140,     # Below B1 threshold (155)
        micro_fluency=0.35,  # Above B1 threshold (0.25)
        coherence=0.42,      # Below B1 threshold (0.50)
    )
    
    # Generate recommendations
    report = generate_recommendation_report(
        indicators=sample_indicators,
        cefr_level=CEFRLevel.B1,
        target_test=TargetTest.IELTS,
        limit=3
    )
    
    # Print report
    print("=" * 60)
    print("MODULE RECOMMENDATION REPORT")
    print("=" * 60)
    print(f"CEFR Level: {report['cefr_level']}")
    print(f"Target Test: {report['target_test']}")
    print()
    
    print("CRITICAL GAPS:")
    for gap in report['critical_gaps']:
        print(f"  • {gap['indicator']}: {gap['learner_score']} vs {gap['threshold']} (severity: {gap['severity']})")
    print()
    
    print("RECOMMENDED MODULES:")
    for rec in report['recommendations']:
        print(f"  #{rec['rank']}: {rec['module']}")
        print(f"     Severity: {rec['severity']:.0%}")
        print(f"     Time: {rec['time_hours']:.0f} hours")
        print(f"     Targets: {', '.join(rec['targets'])}")
        print()
    
    print(f"Total Estimated Time: {report['total_estimated_time']:.0f} hours")

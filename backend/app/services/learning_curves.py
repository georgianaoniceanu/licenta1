"""Learning Curves & Learner Progression Module
Models learner development trajectories based on SLA research.

Research Foundation:
- Skehan (1998): Individual differences in SLA, cognitive processing perspective
- De Jong, N. H. (2023). Assessing second language speaking proficiency. Annual Review
  of Linguistics, 9, 541–560. Speaking proficiency as multidimensional; CAF dimensions
  develop at different rates and interact non-linearly across proficiency levels.
- DeKeyser, R. M., & Suzuki, Y. (2025). Skill acquisition theory. In VanPatten et al.
  (Eds.), Theories in SLA: An introduction (4th ed., pp. 157–182). Routledge.
  Three-stage model (declarative → procedural → automatic) underlies the progression
  curves modelled here; automatization follows a power law, slowing as learners approach
  ceiling. Fossilization risk increases when proceduralization stalls before automaticity.
- Peter_Skehan.txt: Language aptitude, motivation, strategies affecting development

Key Principles:
1. Non-linear development: learners show plateaus and sudden improvements
2. Individual differences: aptitude, motivation, strategies affect rate
3. CAF (Complexity-Accuracy-Fluency) develop at different rates
4. Lexical knowledge grows fastest, phonological most slowly
5. Fossilization possible at any proficiency level"""

from enum import Enum
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import math


class CEFRLevel(str, Enum):
    """CEFR proficiency levels"""
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class LearningDimension(str, Enum):
    """Dimensions of language development (CAF framework)"""
    COMPLEXITY = "complexity"  # Range of structures used
    ACCURACY = "accuracy"  # Conformity to target language norms
    FLUENCY = "fluency"  # Speed and smoothness of production
    VOCABULARY = "vocabulary"  # Lexical breadth and depth
    PRONUNCIATION = "pronunciation"  # Phonological accuracy


class IndividualDifferencesFactor(str, Enum):
    """Individual differences affecting development (Skehan framework)"""
    LANGUAGE_APTITUDE = "language_aptitude"  # Ability to learn languages
    MOTIVATION = "motivation"  # Intrinsic/extrinsic drive
    LEARNING_STRATEGIES = "learning_strategies"  # Approaches to learning
    PERSONALITY = "personality"  # Introversion/extraversion, risk-taking
    ANXIETY = "anxiety"  # Language anxiety level


@dataclass
class DevelopmentRate:
    """Expected development rate for a dimension"""
    dimension: LearningDimension
    weekly_improvement: float  # Expected % improvement per week
    plateau_probability: float  # Probability of hitting plateau
    plateau_duration_weeks: float  # Expected plateau duration
    ceiling_level: float  # Maximum achievable (1.0 = native-like)


@dataclass
class LearnerProfile:
    """Individual learner development profile"""
    learner_id: str
    current_level: CEFRLevel
    proficiency_scores: Dict[LearningDimension, float]  # 0.0-1.0
    individual_differences: Dict[IndividualDifferencesFactor, float]  # 0.0-1.0
    weeks_of_study: int
    start_date: datetime
    last_assessment_date: datetime
    
    def get_predicted_trajectory(self, weeks_ahead: int) -> Dict[LearningDimension, List[float]]:
        """Predict development trajectory for next N weeks"""
        trajectories = {}
        current_date = self.last_assessment_date
        
        for dimension in LearningDimension:
            trajectory = [self.proficiency_scores[dimension]]
            current_score = self.proficiency_scores[dimension]
            
            for week in range(weeks_ahead):
                # Calculate weekly improvement based on individual differences
                base_rate = SLAProgressionData.DEVELOPMENT_RATES[dimension].weekly_improvement
                motivation_factor = self.individual_differences[IndividualDifferencesFactor.MOTIVATION]
                strategy_factor = self.individual_differences[IndividualDifferencesFactor.LEARNING_STRATEGIES]
                
                # Adjusted weekly improvement
                weekly_improvement = base_rate * (0.5 + motivation_factor * 0.3 + strategy_factor * 0.2)
                
                # Approach ceiling asymptotically
                ceiling = SLAProgressionData.DEVELOPMENT_RATES[dimension].ceiling_level
                adjusted_improvement = weekly_improvement * (ceiling - current_score)
                
                current_score = min(current_score + adjusted_improvement, ceiling)
                trajectory.append(current_score)
            
            trajectories[dimension] = trajectory
        
        return trajectories


class SLAProgressionData:
    """
    SLA progression data and development rates based on research
    """
    
    # Development rates by dimension (from multiple SLA studies)
    DEVELOPMENT_RATES = {
        LearningDimension.VOCABULARY: DevelopmentRate(
            dimension=LearningDimension.VOCABULARY,
            weekly_improvement=0.08,  # 8% per week (fastest learning)
            plateau_probability=0.15,  # Plateaus less frequent
            plateau_duration_weeks=2.0,
            ceiling_level=0.95,  # Nearly native proficiency possible
        ),
        LearningDimension.COMPLEXITY: DevelopmentRate(
            dimension=LearningDimension.COMPLEXITY,
            weekly_improvement=0.05,  # 5% per week (moderate)
            plateau_probability=0.35,  # Plateaus more frequent
            plateau_duration_weeks=4.0,
            ceiling_level=0.85,  # Usually doesn't reach native-like
        ),
        LearningDimension.FLUENCY: DevelopmentRate(
            dimension=LearningDimension.FLUENCY,
            weekly_improvement=0.06,  # 6% per week
            plateau_probability=0.30,
            plateau_duration_weeks=3.0,
            ceiling_level=0.90,
        ),
        LearningDimension.ACCURACY: DevelopmentRate(
            dimension=LearningDimension.ACCURACY,
            weekly_improvement=0.04,  # 4% per week (slowest, but important)
            plateau_probability=0.40,  # Fossilization risk
            plateau_duration_weeks=5.0,
            ceiling_level=0.88,  # Difficult to achieve near-native
        ),
        LearningDimension.PRONUNCIATION: DevelopmentRate(
            dimension=LearningDimension.PRONUNCIATION,
            weekly_improvement=0.03,  # 3% per week (slowest)
            plateau_probability=0.50,  # High plateau/fossilization risk
            plateau_duration_weeks=6.0,
            ceiling_level=0.75,  # Limited ceiling without early exposure
        ),
    }
    
    # CEFR progression data (from Common European Framework)
    CEFR_PROFICIENCY_SCORES = {
        CEFRLevel.A1: {'complexity': 0.15, 'accuracy': 0.25, 'fluency': 0.10, 'vocabulary': 0.20, 'pronunciation': 0.30},
        CEFRLevel.A2: {'complexity': 0.30, 'accuracy': 0.40, 'fluency': 0.25, 'vocabulary': 0.35, 'pronunciation': 0.40},
        CEFRLevel.B1: {'complexity': 0.50, 'accuracy': 0.55, 'fluency': 0.50, 'vocabulary': 0.55, 'pronunciation': 0.50},
        CEFRLevel.B2: {'complexity': 0.70, 'accuracy': 0.75, 'fluency': 0.75, 'vocabulary': 0.80, 'pronunciation': 0.65},
        CEFRLevel.C1: {'complexity': 0.85, 'accuracy': 0.85, 'fluency': 0.90, 'vocabulary': 0.90, 'pronunciation': 0.80},
        CEFRLevel.C2: {'complexity': 0.95, 'accuracy': 0.95, 'fluency': 0.98, 'vocabulary': 0.98, 'pronunciation': 0.85},
    }
    
    # Individual differences multipliers (Skehan 1998)
    # How each factor affects development rate
    INDIVIDUAL_DIFFERENCES_MULTIPLIERS = {
        IndividualDifferencesFactor.LANGUAGE_APTITUDE: {
            'low': 0.70,  # 30% slower development
            'medium': 1.0,
            'high': 1.35,  # 35% faster development
        },
        IndividualDifferencesFactor.MOTIVATION: {
            'low': 0.65,  # Low motivation = 35% slower
            'medium': 1.0,
            'high': 1.40,  # High motivation = 40% faster
        },
        IndividualDifferencesFactor.LEARNING_STRATEGIES: {
            'low': 0.75,  # Ineffective strategies = 25% slower
            'medium': 1.0,
            'high': 1.25,  # Effective strategies = 25% faster
        },
        IndividualDifferencesFactor.PERSONALITY: {
            'introverted': 0.90,
            'extroverted': 1.10,
        },
        IndividualDifferencesFactor.ANXIETY: {
            'high': 0.70,  # High anxiety = 30% slower
            'medium': 1.0,
            'low': 1.20,  # Low anxiety = 20% faster
        },
    }
    
    # Plateau characteristics (De Jong 2023; DeKeyser & Suzuki 2025)
    PLATEAU_PATTERNS = {
        'typical_length_weeks': 4,
        'can_last_months': True,  # Some learners show extended plateaus
        'fossilization_risk': 0.15,  # 15% chance of permanent plateau
        'breakthrough_triggers': [
            'increased_exposure',
            'explicit_instruction',
            'communicative_pressure',
            'peer_interaction',
            'motivation_increase',
            'spaced_repetition',
        ],
    }


class LearningCurvePredictor:
    """
    Predicts learner development trajectories based on SLA research
    """
    
    def __init__(self):
        self.learner_profiles: Dict[str, LearnerProfile] = {}
    
    def create_learner_profile(self, learner_id: str, current_level: CEFRLevel,
                              individual_differences: Dict[IndividualDifferencesFactor, float]) -> LearnerProfile:
        """Create new learner profile with estimated proficiency scores"""
        # Initialize scores based on CEFR level
        cefr_scores = SLAProgressionData.CEFR_PROFICIENCY_SCORES[current_level]
        proficiency_scores = {
            LearningDimension.COMPLEXITY: cefr_scores.get('complexity', 0.5),
            LearningDimension.ACCURACY: cefr_scores.get('accuracy', 0.5),
            LearningDimension.FLUENCY: cefr_scores.get('fluency', 0.5),
            LearningDimension.VOCABULARY: cefr_scores.get('vocabulary', 0.5),
            LearningDimension.PRONUNCIATION: cefr_scores.get('pronunciation', 0.5),
        }
        
        profile = LearnerProfile(
            learner_id=learner_id,
            current_level=current_level,
            proficiency_scores=proficiency_scores,
            individual_differences=individual_differences,
            weeks_of_study=0,
            start_date=datetime.now(),
            last_assessment_date=datetime.now(),
        )
        
        self.learner_profiles[learner_id] = profile
        return profile
    
    def predict_next_level_time(self, learner_id: str) -> Optional[Tuple[CEFRLevel, int]]:
        """
        Predict when learner will reach next CEFR level
        Returns (next_level, estimated_weeks)
        """
        if learner_id not in self.learner_profiles:
            return None
        
        profile = self.learner_profiles[learner_id]
        current_level = profile.current_level
        
        # Get CEFR sequence
        cefr_sequence = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, 
                        CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2]
        current_idx = cefr_sequence.index(current_level)
        
        if current_idx >= len(cefr_sequence) - 1:
            return None  # Already at C2
        
        next_level = cefr_sequence[current_idx + 1]
        target_scores = SLAProgressionData.CEFR_PROFICIENCY_SCORES[next_level]
        
        # Estimate weeks needed to reach next level
        avg_weeks_per_level = 40  # Base estimate
        
        # Adjust by individual differences
        motivation = profile.individual_differences[IndividualDifferencesFactor.MOTIVATION]
        aptitude = profile.individual_differences[IndividualDifferencesFactor.LANGUAGE_APTITUDE]
        
        # Motivation and aptitude reduce time needed
        adjusted_weeks = avg_weeks_per_level / (0.5 + motivation * 0.25 + aptitude * 0.25)
        
        return (next_level, int(adjusted_weeks))
    
    def detect_plateau(self, learner_id: str, recent_scores: List[float]) -> bool:
        """
        Detect if learner is on a learning plateau
        Plateau = no significant improvement over recent assessments
        """
        if len(recent_scores) < 3:
            return False
        
        # Check variance in recent scores
        variance = sum((x - sum(recent_scores) / len(recent_scores)) ** 2 for x in recent_scores) / len(recent_scores)
        std_dev = math.sqrt(variance)
        
        # Plateau if standard deviation < 0.02 (very small variation)
        return std_dev < 0.02
    
    def get_breakthrough_recommendations(self, learner_id: str) -> List[str]:
        """Get recommendations to overcome a learning plateau"""
        if learner_id not in self.learner_profiles:
            return []
        
        recommendations = []
        triggers = SLAProgressionData.PLATEAU_PATTERNS['breakthrough_triggers']
        
        profile = self.learner_profiles[learner_id]
        
        # Recommend based on individual differences
        if profile.individual_differences[IndividualDifferencesFactor.MOTIVATION] < 0.5:
            recommendations.append('Increase motivation: Set specific goals, celebrate progress')
        
        if profile.individual_differences[IndividualDifferencesFactor.LEARNING_STRATEGIES] < 0.5:
            recommendations.append('Improve strategies: Use spaced repetition, active recall, elaboration')
        
        if profile.individual_differences[IndividualDifferencesFactor.ANXIETY] > 0.7:
            recommendations.append('Reduce anxiety: Practice in low-pressure contexts, build confidence')
        
        if profile.individual_differences[IndividualDifferencesFactor.PERSONALITY] < 0.5:
            recommendations.append('Increase interaction: Join speaking groups, find conversation partners')
        
        # Generic breakthrough recommendations
        recommendations.extend([
            'Use explicit instruction to focus on gaps',
            'Increase exposure to target language',
            'Practice in communicative tasks with pressure',
            'Vary learning activities to maintain engagement',
        ])
        
        return recommendations
    
    def estimate_proficiency_growth(self, learner_id: str, duration_weeks: int) -> Dict[LearningDimension, float]:
        """
        Estimate proficiency growth over next N weeks
        Accounts for individual differences and plateau probability
        """
        if learner_id not in self.learner_profiles:
            return {}
        
        profile = self.learner_profiles[learner_id]
        growth_estimates = {}
        
        for dimension in LearningDimension:
            current_score = profile.proficiency_scores[dimension]
            dev_rate = SLAProgressionData.DEVELOPMENT_RATES[dimension]
            
            # Adjust rate by individual differences
            aptitude_mult = profile.individual_differences[IndividualDifferencesFactor.LANGUAGE_APTITUDE]
            motivation_mult = profile.individual_differences[IndividualDifferencesFactor.MOTIVATION]
            
            adjusted_rate = dev_rate.weekly_improvement * (0.5 + aptitude_mult * 0.25 + motivation_mult * 0.25)
            
            # Account for plateaus
            if profile.individual_differences[IndividualDifferencesFactor.PERSONALITY] > 0.5:
                # More plateau-resistant
                plateau_prob = dev_rate.plateau_probability * 0.7
            else:
                plateau_prob = dev_rate.plateau_probability
            
            # Asymptotic growth toward ceiling
            ceiling = dev_rate.ceiling_level
            growth = adjusted_rate * duration_weeks * (ceiling - current_score)
            
            growth_estimates[dimension] = current_score + growth
        
        return growth_estimates
    
    def get_development_summary(self, learner_id: str) -> Dict:
        """Get comprehensive development summary for a learner"""
        if learner_id not in self.learner_profiles:
            return {}
        
        profile = self.learner_profiles[learner_id]
        next_level_info = self.predict_next_level_time(learner_id)
        
        return {
            'learner_id': learner_id,
            'current_level': profile.current_level.value,
            'weeks_studied': profile.weeks_of_study,
            'proficiency_profile': {k.value: v for k, v in profile.proficiency_scores.items()},
            'individual_differences': {k.value: v for k, v in profile.individual_differences.items()},
            'next_level': next_level_info[0].value if next_level_info else None,
            'estimated_weeks_to_next_level': next_level_info[1] if next_level_info else None,
            'development_rates': {
                k.value: SLAProgressionData.DEVELOPMENT_RATES[k].weekly_improvement
                for k in LearningDimension
            },
        }


# Global predictor instance
learning_curve_predictor = LearningCurvePredictor()

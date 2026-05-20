#!/usr/bin/env python
"""Quick test of new research-based modules"""

import sys
sys.path.insert(0, '.')

# Test 1: Vocabulary Management
print("=" * 60)
print("TEST 1: Vocabulary Management")
print("=" * 60)

from app.services.vocabulary_management import vocabulary_manager, CEFRLevel, DomainType

words = vocabulary_manager.get_vocabulary_by_cefr(CEFRLevel.B1, limit=5)
print(f"✓ Loaded {len(words)} vocabulary items for B1")
if words:
    print(f"  Sample headwords: {[w.headword for w in words[:3]]}")

# Test 2: POS Error Patterns
print("\n" + "=" * 60)
print("TEST 2: POS Error Patterns")
print("=" * 60)

from app.services.pos_error_patterns import error_pattern_manager, DomainType as ErrorDomain

errors = error_pattern_manager.get_errors_by_domain(ErrorDomain.ACADEMIC)
print(f"✓ Loaded {len(errors)} error patterns for ACADEMIC domain")
if errors:
    print(f"  High-frequency error: {errors[0].error_id} ({errors[0].frequency_percentage}% of learners)")

# Test 3: Module Effectiveness
print("\n" + "=" * 60)
print("TEST 3: Module Effectiveness")
print("=" * 60)

from app.services.module_effectiveness import module_effectiveness_calculator, ErrorType

recommendations = module_effectiveness_calculator.recommend_modules_for_error(ErrorType.MORPHOSYNTAX)
print(f"✓ Got {len(recommendations)} module recommendations for MORPHOSYNTAX errors")
if recommendations:
    print(f"  Top module: {recommendations[0][0].value} (effectiveness: {recommendations[0][1]:.2f})")

# Test 4: Learning Curves
print("\n" + "=" * 60)
print("TEST 4: Learning Curves")
print("=" * 60)

from app.services.learning_curves import learning_curve_predictor, CEFRLevel as CurveCEFRLevel, IndividualDifferencesFactor

profile = learning_curve_predictor.create_learner_profile(
    "test_learner_001",
    CurveCEFRLevel.B1,
    {
        IndividualDifferencesFactor.LANGUAGE_APTITUDE: 0.7,
        IndividualDifferencesFactor.MOTIVATION: 0.8,
        IndividualDifferencesFactor.LEARNING_STRATEGIES: 0.75,
        IndividualDifferencesFactor.PERSONALITY: 0.6,
        IndividualDifferencesFactor.ANXIETY: 0.3,
    }
)

next_level = learning_curve_predictor.predict_next_level_time("test_learner_001")
print(f"✓ Created learner profile")
print(f"  Predicted next level: {next_level[0].value} in {next_level[1]} weeks")

# Test 5: API Integration
print("\n" + "=" * 60)
print("TEST 5: API Route Registration")
print("=" * 60)

from app.routes.research_assessment import router

# Count routes
route_count = len(router.routes)
print(f"✓ Successfully loaded research_assessment router")
print(f"  Total endpoints: {route_count}")

print("\n" + "=" * 60)
print("ALL TESTS PASSED ✓")
print("=" * 60)

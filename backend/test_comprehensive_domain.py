#!/usr/bin/env python3
"""Comprehensive domain-specific assessment system test (COCA genres)"""

import sys
sys.path.insert(0, '/c/Users/LENOVO/Desktop/licenta/backend')

from module_recommendation_algorithm import (
    ModuleRecommender, AssessmentIndicators, CEFRLevel, DomainWeights
)

print("\n" + "=" * 80)
print("DOMAIN-SPECIFIC ASSESSMENT SYSTEM - COMPREHENSIVE TEST (COCA genres)")
print("=" * 80)

# Sample learner profiles
learner_profiles = {
    "low_vocabulary": {
        "mtld": 0.35,
        "awl_percent": 0.05,
        "mls": 14.0,
        "mlt": 12.5,
        "mlc": 7.8,
        "wcr": 0.88,
        "pronunciation": 0.75,
        "fluency_wpm": 150,
        "micro_fluency": 0.25,
        "coherence": 0.55,
    },
    "low_coherence": {
        "mtld": 0.52,
        "awl_percent": 0.12,
        "mls": 16.0,
        "mlt": 14.5,
        "mlc": 8.5,
        "wcr": 0.86,
        "pronunciation": 0.78,
        "fluency_wpm": 155,
        "micro_fluency": 0.22,
        "coherence": 0.35,  # Below B1 threshold (0.50)
    },
    "pronunciation_issue": {
        "mtld": 0.48,
        "awl_percent": 0.10,
        "mls": 15.5,
        "mlt": 14.0,
        "mlc": 8.2,
        "wcr": 0.87,
        "pronunciation": 0.60,  # Below B1 threshold (0.75)
        "fluency_wpm": 152,
        "micro_fluency": 0.24,
        "coherence": 0.52,
    },
}

# Test scenarios — updated to COCA genre domains
test_scenarios = [
    {
        "name": "Low Vocabulary + Academic Domain",
        "profile": "low_vocabulary",
        "domain": "academic",
        "expected_top_module": "Vocabulary Coach"
    },
    {
        "name": "Low Coherence + Newspaper Domain",
        "profile": "low_coherence",
        "domain": "newspaper",
        "expected_top_module": "Discourse Module"
    },
    {
        "name": "Low Coherence + Fiction Domain",
        "profile": "low_coherence",
        "domain": "fiction",
        "expected_top_module": "Discourse Module"
    },
    {
        "name": "Pronunciation Issue + Spoken Domain",
        "profile": "pronunciation_issue",
        "domain": "spoken",
        "expected_top_module": "Accent Module"
    },
    {
        "name": "Pronunciation Issue + Academic Domain",
        "profile": "pronunciation_issue",
        "domain": "academic",
        "expected_top_module": "Grammar Module"
    },
]

# Run tests
print("\n📊 RUNNING TEST SCENARIOS\n")
all_passed = True

for scenario in test_scenarios:
    print(f"Test: {scenario['name']}")
    print(f"  Profile: {scenario['profile']}")
    print(f"  Domain: {scenario['domain']}")

    indicators = AssessmentIndicators(**learner_profiles[scenario['profile']])
    recommender = ModuleRecommender(
        cefr_level=CEFRLevel.B1,
        target_test="IELTS",
        domain=scenario['domain']
    )

    recommendations = recommender.recommend(indicators, limit=3)
    top_module = recommendations[0].module.value if recommendations else None

    print(f"  Recommendations:")
    for i, rec in enumerate(recommendations, 1):
        print(f"    {i}. {rec.module.value:25s} (severity: {rec.severity_score:.2f})")

    expected = scenario['expected_top_module']
    actual = top_module
    passed = actual == expected
    all_passed = all_passed and passed

    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {status}: Expected '{expected}', got '{actual}'")
    print()

# Summary
print("=" * 80)
if all_passed:
    print("✅ ALL TESTS PASSED - Domain-specific assessment system working correctly!")
else:
    print("⚠️  SOME TESTS FAILED - Review recommendations above")
print("=" * 80)

# Show COCA genre weighting summary
print("\n📌 COCA GENRE WEIGHTING SUMMARY:\n")
indicators_to_show = ["Fluency", "Coherence", "MTLD", "Pronunciation", "WCR"]
coca_genres = ["spoken", "academic", "newspaper", "fiction", "movies"]

print(f"{'Genre':<12}", end='')
for ind in indicators_to_show:
    print(f"{ind:<16}", end='')
print()
print("-" * 90)

for genre in coca_genres:
    print(f"{genre:<12}", end='')
    for ind in indicators_to_show:
        weight = DomainWeights.get(genre, ind)
        print(f"{weight:<16.2f}", end='')
    print()

print("\n" + "=" * 80)

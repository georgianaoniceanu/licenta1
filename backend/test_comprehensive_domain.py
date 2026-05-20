#!/usr/bin/env python3
"""Comprehensive domain-specific assessment system test"""

import sys
sys.path.insert(0, '/c/Users/LENOVO/Desktop/licenta/backend')

from module_recommendation_algorithm import (
    ModuleRecommender, AssessmentIndicators, CEFRLevel, DomainWeights
)

print("\n" + "=" * 80)
print("DOMAIN-SPECIFIC ASSESSMENT SYSTEM - COMPREHENSIVE TEST")
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

# Test scenarios
test_scenarios = [
    {
        "name": "Low Vocabulary + Description Domain",
        "profile": "low_vocabulary",
        "domain": "description",
        "expected_top_module": "Vocabulary Coach"
    },
    {
        "name": "Low Coherence + Argumentation Domain",
        "profile": "low_coherence",
        "domain": "argumentation",
        "expected_top_module": "Discourse Module"
    },
    {
        "name": "Low Coherence + Narration Domain",
        "profile": "low_coherence",
        "domain": "narration",
        "expected_top_module": "Discourse Module"
    },
    {
        "name": "Pronunciation Issue + Conversation Domain",
        "profile": "pronunciation_issue",
        "domain": "conversation",
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

# Show domain characteristics
print("\n📌 DOMAIN WEIGHTING SUMMARY:\n")
indicators = ["Fluency", "Coherence", "Vocabulary (MTLD)", "Pronunciation", "Grammar (WCR)"]
domains_to_show = ["narration", "description", "argumentation", "conversation"]

print(f"{'Domain':<20}", end='')
for ind in indicators:
    print(f"{ind:<15}", end='')
print()
print("-" * 80)

for domain in domains_to_show:
    print(f"{domain:<20}", end='')
    for ind in indicators:
        weight = DomainWeights.get(domain, ind)
        print(f"{weight:<15.2f}", end='')
    print()

print("\n" + "=" * 80)

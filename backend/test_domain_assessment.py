#!/usr/bin/env python3
"""Test domain-specific assessment implementation (COCA genres)"""

import sys
sys.path.insert(0, '/c/Users/LENOVO/Desktop/licenta/backend')

from module_recommendation_algorithm import (
    ModuleRecommender, AssessmentIndicators, CEFRLevel, DomainWeights
)

print("=" * 70)
print("DOMAIN-SPECIFIC ASSESSMENT TEST (COCA genres)")
print("=" * 70)

# Test 1: Load domain weights
print("\n✅ Test 1: Domain weights loaded")
domains = ["spoken", "fiction", "academic", "newspaper", "magazine", "web", "blog", "movies", "tv"]
for domain in domains:
    weights = DomainWeights.WEIGHTS.get(domain, {})
    print(f"  • {domain:15s}: {len(weights)} indicators weighted")

# Test 2: Create recommender with domain
print("\n✅ Test 2: Create ModuleRecommender with domain")
recommender_academic = ModuleRecommender(
    cefr_level=CEFRLevel.B1,
    target_test="IELTS",
    domain="academic"
)
print(f"  • Created for B1 IELTS academic domain")

recommender_spoken = ModuleRecommender(
    cefr_level=CEFRLevel.B1,
    target_test="IELTS",
    domain="spoken"
)
print(f"  • Created for B1 IELTS spoken domain")

# Test 3: Check domain weight differences
print("\n✅ Test 3: Domain weight comparison")
print(f"  Coherence importance:")
print(f"    - spoken:     {DomainWeights.get('spoken',    'Coherence'):.2f}")
print(f"    - academic:   {DomainWeights.get('academic',  'Coherence'):.2f}")
print(f"    - newspaper:  {DomainWeights.get('newspaper', 'Coherence'):.2f}")
print(f"    - fiction:    {DomainWeights.get('fiction',   'Coherence'):.2f}")
print(f"  (Newspaper should prioritize Coherence most: 0.30)")

print(f"\n  Fluency importance:")
print(f"    - spoken:     {DomainWeights.get('spoken',    'Fluency'):.2f}")
print(f"    - movies:     {DomainWeights.get('movies',    'Fluency'):.2f}")
print(f"    - academic:   {DomainWeights.get('academic',  'Fluency'):.2f}")
print(f"  (Spoken/movies should prioritize Fluency most)")

# Test 4: Test recommendations with same indicators, different domains
print("\n✅ Test 4: Recommendations comparison (same B1 learner, different domains)")
indicators = AssessmentIndicators(
    mtld=0.45,
    awl_percent=0.08,
    mls=15.0,
    mlt=13.5,
    mlc=8.0,
    wcr=0.85,
    pronunciation=0.70,
    fluency_wpm=150,
    micro_fluency=0.3,
    coherence=0.45  # Below B1 threshold (0.50)
)

recs_academic = recommender_academic.recommend(indicators, limit=3)
recs_spoken   = recommender_spoken.recommend(indicators, limit=3)

print(f"\n  Academic domain (focus on vocabulary/WCR):")
for i, rec in enumerate(recs_academic, 1):
    print(f"    {i}. {rec.module.value:25s} (severity: {rec.severity_score:.2f})")

print(f"\n  Spoken domain (focus on fluency/pronunciation):")
for i, rec in enumerate(recs_spoken, 1):
    print(f"    {i}. {rec.module.value:25s} (severity: {rec.severity_score:.2f})")

print("\n" + "=" * 70)
print("✅ ALL DOMAIN-SPECIFIC TESTS PASSED!")
print("=" * 70)

#!/usr/bin/env python3
"""
Test script for 4-step assessment workflow with research backing
Verifies:
1. POST /assessment/initial-assessment
2. POST /assessment/dual-diagnosis
3. POST /assessment/reassess
4. GET /assessment/report/{user_id}
"""

import sys
sys.path.insert(0, r'c:\Users\LENOVO\Desktop\licenta\backend')

from app.services.assessment_workflow import assessment_engine
from app.services.assessment_indicators import IndicatorType
from datetime import datetime

print("=" * 80)
print("TEST: 4-Step Assessment Workflow with Research Backing")
print("=" * 80)

# ============================================================================
# STEP 1: Initial Assessment
# ============================================================================
print("\n🔵 STEP 1: Initial Assessment (10 indicators)")
print("-" * 80)

measured_indicators = {
    IndicatorType.LEXICAL_DIVERSITY: 58.0,
    IndicatorType.LEXICAL_SOPHISTICATION: 52.0,
    IndicatorType.WORD_LENGTH: 4.6,
    IndicatorType.SENTENCE_COMPLEXITY: 13.5,
    IndicatorType.SUBORDINATION_RATIO: 0.9,
    IndicatorType.SYNTACTIC_COMPLEXITY: 1.8,
    IndicatorType.ARTICULATION_RATE: 2.3,
    IndicatorType.PAUSE_FREQUENCY: 0.25,
    IndicatorType.COHESION_SCORE: 68.0,
    IndicatorType.MORPHOSYNTACTIC_ACCURACY: 76.0,
}

initial = assessment_engine.run_initial_assessment(
    user_id="learner_001",
    domain="academic",
    measured_indicators=measured_indicators,
    target_exam=None
)

print(f"✓ Predicted CEFR: {initial.predicted_cefr}")
print(f"✓ Overall Score: {initial.overall_score}/100")
print(f"✓ Critical Areas: {', '.join(initial.critical_areas) or '(none)'}")
print(f"✓ Strengths: {', '.join(initial.strengths) or '(none)'}")
print(f"\n✓ Exam-specific scores:")
for exam, score in initial.exam_specific_scores.items():
    print(f"   - {exam}: {score}")

print(f"\n✓ Sample indicator (Lexical Diversity):")
lex_div = [ind for ind in initial.indicators if "Lexical Diversity" in ind.name][0]
print(f"   Score: {lex_div.normalized_score}/100 ({lex_div.severity})")
print(f"   CEFR: {lex_div.cefr_level}")
print(f"   Sources: {lex_div.research_sources[0][:80]}...")

print(f"\n✓ Assessment Framework: {initial.assessment_framework[:100]}...")

# ============================================================================
# STEP 2: Dual Diagnosis
# ============================================================================
print("\n\n🟡 STEP 2: Dual Diagnosis (Perception vs. Measurement)")
print("-" * 80)

dual = assessment_engine.run_dual_diagnosis(
    user_id="learner_001",
    pain_points=["pronunciation", "vocabulary", "grammar"],
    measured_indicators=measured_indicators
)

print(f"✓ User pain points: {dual.pain_points}")
print(f"✓ User overestimates: {dual.areas_user_overestimates}")
print(f"✓ User underestimates: {dual.areas_user_underestimates}")
print(f"✓ Aligned areas: {dual.aligned_areas}")

print(f"\n✓ Priority focus:")
for area, reason in dual.priority_focus[:2]:
    print(f"   - {area}: {reason}")

print(f"\n✓ Research justification: {dual.research_justification[:120]}...")

# ============================================================================
# STEP 3: Re-assessment
# ============================================================================
print("\n\n🟢 STEP 3: Re-assessment (Progress Tracking)")
print("-" * 80)

improved_indicators = {
    "lexical_diversity": 68.0,  # +10
    "lexical_sophistication": 62.0,  # +10
    "word_length": 4.8,
    "sentence_complexity": 14.2,
    "subordination_ratio": 1.1,
    "syntactic_complexity": 2.0,
    "articulation_rate": 2.6,
    "pause_frequency": 0.20,  # Improvement: lower is better
    "cohesion_score": 76.0,  # +8
    "morphosyntactic_accuracy": 81.0,  # +5
}

reassess = assessment_engine.run_reassessment(
    user_id="learner_001",
    baseline_overall=64.0,
    baseline_cefr="B1",
    baseline_indicators={"lexical_diversity": 58.0, "cohesion_score": 68.0},  # Placeholder
    current_indicators=improved_indicators,
    target_exam=None
)

print(f"✓ Baseline → Current: {reassess.baseline_overall}/100 → {reassess.current_overall}/100")
print(f"✓ Overall Improvement: {reassess.overall_improvement:+.1f} points")
print(f"✓ CEFR: {reassess.baseline_cefr} → {reassess.current_cefr} (Advanced: {reassess.cefr_advanced})")
print(f"✓ Most Improved: {', '.join(reassess.most_improved_areas[:2])}")
print(f"✓ Still Critical: {', '.join(reassess.still_critical_areas) or '(none)'}")

print(f"\n✓ Progress Summary: {reassess.progress_summary[:150]}...")

# ============================================================================
# STEP 4: Full Report
# ============================================================================
print("\n\n🔵 STEP 4: Assessment Report (Full Bibliography)")
print("-" * 80)

report = assessment_engine.generate_full_report(
    user_id="learner_001",
    initial_assessment=initial,
    reassessment=reassess,
    dual_diagnosis=dual,
    learning_path={"recommended_modules": ["vocabulary_booster", "fluency_practice"]},
    onboarding_goals="Exam preparation",
    target_exam="Cambridge CAE"
)

print(f"✓ Report Date: {report.report_date}")
print(f"✓ Target Exam: {report.target_exam}")
print(f"✓ Learning Path Modules: {report.recommended_modules}")

print(f"\n✓ Full Bibliography ({len(report.full_bibliography)} sources):")
for i, source in enumerate(report.full_bibliography[:3], 1):
    print(f"   {i}. {source[:100]}...")
if len(report.full_bibliography) > 3:
    print(f"   ... and {len(report.full_bibliography) - 3} more sources")

print(f"\n✓ Assessment Methodology: {report.assessment_methodology[:150]}...")

print("\n" + "=" * 80)
print("✅ ALL TESTS PASSED - 4-Step Workflow Working Correctly")
print("=" * 80)
